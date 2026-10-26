-- =============================================================================
-- Tandartspraktijk de Tandenborstel: schema voor afspraken
--
-- Gebaseerd op het ERD (arts, behandelingen, beschikbaarheid, reserveringen).
-- Tijdelijke afwijking: de tabel `clienten` komt pas samen met inloggen. Tot die
-- tijd staan naam en e-mailadres direct in `reserveringen`. Later worden die
-- vervangen door `client_id references clienten(id)`.
--
-- Uitvoeren: plak dit bestand in de SQL Editor van Supabase, of gebruik de
-- Supabase CLI (`supabase db push`).
-- =============================================================================

-- Nodig voor de exclusion constraint (bigint `=` in een GiST-index).
create schema if not exists extensions;
create
extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------

create table public.arts
(
    id   bigint generated always as identity primary key,
    naam text not null,
    type text not null -- bijv. "tandarts" of "mondhygiënist"
);

create table public.behandelingen
(
    id   bigint generated always as identity primary key,
    -- Niet in het ERD, wel nodig voor de url (/afspraken/maken/bleken).
    slug text not null unique check (slug ~ '^[a-z0-9-]+$'
) ,
    type  text not null,                        -- weergavenaam, bijv. "Tanden bleken"
    duur  integer not null check (duur > 0)     -- in minuten
);

create table public.beschikbaarheid
(
    id        bigint generated always as identity primary key,
    arts_id   bigint not null references public.arts (id) on delete cascade,
    datum     date   not null,
    starttijd time   not null,
    eindtijd  time   not null,
    constraint beschikbaarheid_tijden_check check (eindtijd > starttijd)
);

create index beschikbaarheid_datum_arts_idx on public.beschikbaarheid (datum, arts_id);

create table public.reserveringen
(
    id             bigint generated always as identity primary key,
    arts_id        bigint not null references public.arts (id) on delete restrict,
    behandeling_id bigint not null references public.behandelingen (id) on delete restrict,
    -- Tijdelijk, tot de tabel clienten er is:
    naam           text   not null check (char_length(naam) between 1 and 100),
    email          text   not null check (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
) ,
    datum           date not null,
    starttijd       time not null,
    eindtijd        time not null,
    aangemaakt_op   timestamptz not null default now(),
    constraint reserveringen_tijden_check check (eindtijd > starttijd),
    -- Een arts kan nooit twee overlappende reserveringen hebben. Dit is de
    -- laatste verdedigingslinie tegen dubbele boekingen, ook bij gelijktijdige
    -- requests: de database zelf weigert de tweede insert.
    constraint reserveringen_geen_overlap exclude using gist (
        arts_id with =,
        tsrange(datum + starttijd, datum + eindtijd) with &&
    )
);

create index reserveringen_datum_arts_idx on public.reserveringen (datum, arts_id);

-- -----------------------------------------------------------------------------
-- Toegang via de Data API
--
-- Sinds 2026 maakt Supabase nieuwe tabellen niet meer automatisch bereikbaar
-- voor de API. Zonder deze grants weigert Postgres elke query van de app,
-- nog vóórdat Row Level Security aan de beurt is.
--
-- Let op: een grant zegt alleen dat een rol de tabel mag aanspreken. Welke
-- rijen iemand mag zien of wijzigen, regel je met Row Level Security. Zolang
-- RLS uit staat, kan iedereen met de publishable key dus alles in deze tabellen
-- lezen.
-- -----------------------------------------------------------------------------

grant
select
on public.arts, public.behandelingen, public.beschikbaarheid, public.reserveringen
    to anon;
grant
select,
insert
,
update,
delete
on public.arts, public.behandelingen, public.beschikbaarheid, public.reserveringen
    to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Functies (aan te roepen via supabase.rpc)
-- -----------------------------------------------------------------------------

-- Vrije starttijden voor een behandeling op een datum.
-- Een starttijd is vrij als minstens één arts op dat moment beschikbaar is
-- voor de hele duur van de behandeling en dan geen andere reservering heeft.
create
or replace function public.beschikbare_tijden(
    p_behandeling        text,
    p_datum              date,
    p_interval_minuten   integer default 30
)
returns table (starttijd time)
language sql
stable
set search_path = ''
as $$
    with behandeling as (
        select make_interval(mins => b.duur) as duur
        from public.behandelingen b
        where b.slug = p_behandeling
    ),
    kandidaten as (
        select
            bs.arts_id,
            slot::time                    as starttijd,
            (slot + behandeling.duur)::time as eindtijd
        from public.beschikbaarheid bs
        cross join behandeling
        cross join lateral generate_series(
            p_datum + bs.starttijd,
            p_datum + bs.eindtijd - behandeling.duur,
            make_interval(mins => p_interval_minuten)
        ) as slot
        where bs.datum = p_datum
    )
select distinct k.starttijd
from kandidaten k
where not exists (select 1
                  from public.reserveringen r
                  where r.arts_id = k.arts_id
                    and r.datum = p_datum
                    and r.starttijd < k.eindtijd
                    and r.eindtijd > k.starttijd)
order by k.starttijd;
$$;

-- Boekt een afspraak bij de eerste vrije arts, in één transactie.
-- Foutcodes:
--   P0002  onbekende behandeling
--   23P01  tijdstip niet (meer) beschikbaar
create
or replace function public.boek_afspraak(
    p_behandeling  text,
    p_datum        date,
    p_starttijd    time,
    p_naam         text,
    p_email        text
)
returns public.reserveringen
language plpgsql
set search_path = ''
as $$
declare
v_behandeling  public.behandelingen;
    v_eindtijd
time;
    v_arts_id
bigint;
    v_reservering
public.reserveringen;
begin
select *
into v_behandeling
from public.behandelingen
where slug = p_behandeling;

if
not found then
        raise exception 'Onbekende behandeling: %', p_behandeling using errcode = 'P0002';
end if;

    -- Boekingen op dezelfde dag één voor één afhandelen, zodat twee
    -- gelijktijdige requests niet allebei denken dat dezelfde arts vrij is.
    perform
pg_advisory_xact_lock(hashtext('boek_afspraak:' || p_datum::text));

    -- Alleen tijden die de gebruiker ook echt aangeboden kreeg zijn geldig.
    if
not exists (
        select 1
        from public.beschikbare_tijden(p_behandeling, p_datum) t
        where t.starttijd = p_starttijd
    ) then
        raise exception 'Tijdstip niet beschikbaar' using errcode = '23P01';
end if;

    v_eindtijd
:= p_starttijd + make_interval(mins => v_behandeling.duur);

select bs.arts_id
into v_arts_id
from public.beschikbaarheid bs
where bs.datum = p_datum
  and bs.starttijd <= p_starttijd
  and bs.eindtijd >= v_eindtijd
  and not exists (select 1
                  from public.reserveringen r
                  where r.arts_id = bs.arts_id
                    and r.datum = p_datum
                    and r.starttijd < v_eindtijd
                    and r.eindtijd > p_starttijd)
order by bs.arts_id limit 1;

insert into public.reserveringen (arts_id, behandeling_id, naam, email, datum, starttijd, eindtijd)
values (v_arts_id, v_behandeling.id, p_naam, p_email, p_datum, p_starttijd, v_eindtijd) returning *
into v_reservering;

return v_reservering;
end;
$$;

-- Functies zijn standaard door iedereen aan te roepen. Voorlopig alleen de server.
revoke execute on function public.beschikbare_tijden(text, date, integer) from public, anon, authenticated;
revoke execute on function public.boek_afspraak(text, date, time, text, text) from public, anon, authenticated;
grant
execute
on
function
public
.
beschikbare_tijden
(text, date, integer) to service_role;
grant execute on function public.boek_afspraak
(text, date, time, text, text) to service_role;
