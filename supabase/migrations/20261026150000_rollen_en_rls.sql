create table public.receptionist (
    id bigint generated always as identity primary key,
    naam text not null,
    user_id uuid unique references auth.users (id) on delete cascade
);

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

create or replace function public.heeft_rol(rol text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
if rol = 'receptionist' then
    return exists (
        select 1
        from public.receptionist
        where user_id = (select auth.uid())
    );
end if;
if rol = 'tandarts' then
    return exists (
        select 1
        from public.arts
        where user_id = (select auth.uid())
    );
end if;
return false;
end;
$$;

alter table public.arts enable row level security;
alter table public.receptionist enable row level security;
alter table public.behandelingen enable row level security;
alter table public.beschikbaarheid enable row level security;
alter table public.reserveringen enable row level security;

create
policy "gebruikers kunnen behandelingen inzien"
on "public"."behandelingen"
for
select
    to public
    using (true);


create
policy "Arts leest eigen gegevens"
on "public"."arts"
for
select
    to authenticated
    using (
    ((SELECT auth.uid() AS uid) = user_id)
    );

create
policy "Receptionist voegt extra afspraak toe"

on "public"."reserveringen"
for insert
to authenticated

with check (
  public.heeft_rol('receptionist'::text)

);