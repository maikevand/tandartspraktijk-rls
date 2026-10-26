-- =============================================================================
-- Inloggen voor artsen: de basis
--
-- Deze migratie krijg je kant-en-klaar. Ze regelt:
--   1. de koppeling tussen een arts en een account in Supabase Auth (user_id),
--      en een trigger die bij elke registratie automatisch een arts aanmaakt;
--   2. twee functies waarmee bezoekers vrije tijden opvragen en een afspraak
--      maken, zonder zelf in de tabellen te hoeven lezen of schrijven.
--
-- Row Level Security staat nog UIT. RLS aanzetten en de policies schrijven doe
-- je zelf in Supabase (stap 3 en 4 van de opdracht).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Arts koppelen aan een gebruiker uit Supabase Auth
-- -----------------------------------------------------------------------------

-- Nullable: de artsen uit de seed hebben (nog) geen account.
alter table public.arts
    add column user_id uuid unique references auth.users (id) on delete cascade;

alter table public.arts
    add constraint arts_type_check check (type in ('tandarts', 'mondhygiënist'));

create index arts_user_id_idx on public.arts (user_id);

-- Let op (stap 3): deze trigger maakt nu van ELKE nieuwe gebruiker een arts.
-- Pas hem aan zodra je meer rollen hebt, zoals de receptionist.
--
-- Maakt bij elke registratie automatisch de bijbehorende arts aan, met de
-- naam en functie die de app als metadata meestuurt bij signUp().
-- SECURITY DEFINER: de functie draait met de rechten van haar eigenaar, niet
-- met die van de nieuwe gebruiker. Zo blijft de trigger werken als jij straks
-- met RLS dichtzet wie er in `arts` mag schrijven.
create or replace function public.maak_arts_voor_nieuwe_gebruiker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
return new;
end;
$$;

create trigger maak_arts_na_registratie
    after insert on auth.users
    for each row execute function public.maak_arts_voor_nieuwe_gebruiker();

-- De trigger-functie hoeft door niemand rechtstreeks aangeroepen te worden.
revoke execute on function public.maak_arts_voor_nieuwe_gebruiker() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Functies voor bezoekers
--
-- In beschikbaarheid en reserveringen staan namen en e-mailadressen. Bezoekers
-- horen die tabellen straks niet te kunnen lezen. Deze twee functies draaien
-- daarom als SECURITY DEFINER: ze lezen wat nodig is, maar geven alleen vrije
-- tijden terug of maken precies één, volledig gecontroleerde reservering.
-- `set search_path = ''` (in de eerste migratie) voorkomt dat iemand via een
-- eigen schema een functie of tabel kan onderschuiven.
-- -----------------------------------------------------------------------------

alter function public.beschikbare_tijden(text, date, integer) security definer;
alter function public.boek_afspraak(text, date, time, text, text) security definer;

grant execute on function public.beschikbare_tijden(text, date, integer) to anon, authenticated;
grant execute on function public.boek_afspraak(text, date, time, text, text) to anon, authenticated;
