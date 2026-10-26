-- Testdata. Voer dit uit na de migratie (SQL Editor), of laat de Supabase CLI
-- het automatisch doen bij `supabase db reset`.

insert into public.arts (naam, type)
values ('Dr. S. Jansen', 'tandarts'),
       ('Dr. M. de Vries', 'tandarts');

insert into public.behandelingen (slug, type, duur)
values ('controle', 'Periodieke controle', 30),
       ('bleken', 'Tanden bleken', 60),
       ('klacht', 'Pijn of klacht', 30);

-- Beide artsen werken op werkdagen in september 2026:
-- Dr. Jansen 09:00-12:00, Dr. de Vries 09:00-12:00 en 13:00-17:00.
insert into public.beschikbaarheid (arts_id, datum, starttijd, eindtijd)
select a.id, dag::date, blok.starttijd, blok.eindtijd
from public.arts a
         cross join generate_series('2026-09-01'::date, '2026-09-30'::date, interval '1 day') as dag
         cross join (values ('09:00'::time, '12:00'::time, false),
                            ('13:00'::time, '17:00'::time, true)) as blok (starttijd, eindtijd, alleen_middag_arts)
where extract(isodow from dag) <= 5
  and (not blok.alleen_middag_arts or a.naam = 'Dr. M. de Vries');
