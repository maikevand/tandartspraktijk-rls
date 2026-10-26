# Huiswerkopdracht – Authenticatie, autorisatie en Row Level Security

## Casus

In de vorige opdracht heb je een database voor een tandartspraktijk ingericht in Supabase en gekoppeld aan een Next.js-applicatie. Je kunt inmiddels gegevens ophalen, weergeven en toevoegen.

Maar op dit moment is er nog geen onderscheid tussen verschillende gebruikers. In een echte tandartspraktijk mag natuurlijk niet iedereen zomaar alle patiëntgegevens bekijken of wijzigen. Daarom ga je in deze opdracht authenticatie, autorisatie en Row Level Security (RLS) implementeren, zodat gebruikers alleen toegang hebben tot gegevens waarvoor ze bevoegd zijn.

> **Authenticatie** is vaststellen *wie* iemand is (inloggen). **Autorisatie** is bepalen *wat* iemand mag. Supabase Auth regelt het eerste; voor het tweede gebruik je rollen en RLS.

## Startpunt

Je bouwt verder op de applicatie van de vorige lessen. Er staat al:

- **De openbare kant:** bezoekers kunnen zonder in te loggen een afspraak maken via `/afspraken`.
- **Pagina's voor artsen:** formulieren voor `/registreren` en `/inloggen`, en een pagina `/mijn-afspraken` met een uitlogknop.
- **De Supabase-clients:** `lib/supabase/server.ts` (met de sessie van de gebruiker), `lib/supabase/public.ts` (zonder sessie) en `proxy.ts`, die de sessie ververst.
- **De migratie `auth_basis`:**
  - de kolom `arts.user_id`, die een arts koppelt aan een account in Supabase Auth;
  - een trigger die bij elke registratie een arts aanmaakt;
  - twee functies waarmee bezoekers vrije tijden opvragen en een afspraak maken.

Row Level Security staat nog **uit**. Op dit moment kan iedereen met de publishable key alle tabellen lezen, ook de namen en e-mailadressen van patiënten. De aanroepen naar Supabase Auth, de rollen en RLS bouw je zelf. In de code staan daarvoor `TODO`'s met het stapnummer van deze opdracht.

## Voorbereiding

Je gaat verder met je Supabase-project en de koppeling uit les 7: dezelfde tabellen, dezelfde testgegevens en dezelfde `.env.local`. Wat er voor deze les bij komt:

1. Voer in de **SQL Editor** `supabase/migrations/20261020120000_auth_basis.sql` uit.
2. Zet onder **Authentication > URL Configuration** de *Site URL* op `http://localhost:3000` en voeg `http://localhost:3000/**` toe aan de *Redirect URLs*.
3. Zet onder **Authentication > Sign In / Providers > Email** de optie *Confirm email* uit. Dan ben je na registreren direct ingelogd en hoef je tijdens het ontwikkelen niet op mails te wachten.
4. `npm install` en `npm run dev`. Het maken van een afspraak via `/afspraken` werkt nu al. `/registreren` en `/inloggen` geven een melding dat ze nog niet gebouwd zijn.

> Begin je met een nieuw Supabase-project? Voer dan vóór stap 1 eerst `supabase/migrations/20261014120000_afspraken_schema.sql` en `supabase/seed.sql` uit (de database van les 7), en vul `.env.local` met de url en de publishable key van je project (zie `.env.example`).

## Opdracht

Breid de applicatie uit met gebruikersaccounts, rollen en toegangsrechten. Gebruik de officiële documentatie:

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase – Auth with Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase – Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Stap 1. Gebruikersrollen bepalen

Je applicatie krijgt minimaal deze twee rollen:

- **Tandarts:** kan zijn eigen afspraken en de bijbehorende patiëntgegevens bekijken.
- **Receptionist:** kan afspraken beheren voor alle tandartsen.
- **Patiënt (bonus):** kan uitsluitend eigen gegevens en afspraken bekijken. Hiervoor maak je de tabel `clienten` uit het ERD en koppel je `reserveringen` via `client_id` aan een patiënt.

Daarnaast is er de **bezoeker** die niet is ingelogd. Die mag al behandelingen lezen en via de functies `beschikbare_tijden()` en `boek_afspraak()` een afspraak maken. Dat blijft zo.

Beschrijf per rol wat de gebruiker mag **lezen, toevoegen, wijzigen en verwijderen** in de tabellen die er al zijn: `arts`, `behandelingen`, `beschikbaarheid` en `reserveringen` (en `clienten` als je de bonus doet). Gebruik daarvoor de tabel onder [Rollen en toegangsrechten](#rollen-en-toegangsrechten).

Begin bij "mag niets" en zet alleen open wat een rol echt nodig heeft.

### Stap 2. Authenticatie implementeren

Zorg dat gebruikers een account kunnen aanmaken, kunnen inloggen met e-mailadres en wachtwoord, en weer kunnen uitloggen. De formulieren bestaan al. Jij schrijft de aanroepen naar Supabase Auth op de plekken met `TODO stap 2`:

| Onderdeel | Bestand |
|---|---|
| Registreren | `app/registreren/actions.ts` |
| Inloggen | `app/inloggen/actions.ts` (functie `login`) |
| Bepalen wie er is ingelogd | `lib/auth.ts` (functie `getIngelogdeArts`) |
| Uitloggen | `app/inloggen/actions.ts` (functie `uitloggen`) |

- Maak minimaal twee testaccounts aan met verschillende rollen: een tandarts en een receptionist.
- Zorg dat de applicatie controleert of de gebruiker is ingelogd voordat hij een beveiligde pagina te zien krijgt. Voor `/mijn-afspraken` doet `vereisIngelogdeArts()` dat al zodra `getIngelogdeArts()` werkt. Doe hetzelfde voor de pagina's die je zelf toevoegt.

Je bent klaar met deze stap als je na registreren of inloggen op `/mijn-afspraken` terechtkomt met "Welkom, &lt;jouw naam&gt;", en na uitloggen weer wordt doorgestuurd naar `/inloggen`.

> Er zijn meerdere functies in `supabase.auth` die iets over de sessie teruggeven. Waarom mag je op de server niet vertrouwen op `getSession()`?

### Stap 3. Autorisatie implementeren

Supabase Auth weet wie er is ingelogd, maar niet wat die persoon mag. Welke rol bij welke gebruiker hoort, leg je zelf vast in de database.

**Bepaal hoe je de rollen opslaat.** Je hebt een paar mogelijkheden:

1. **Eén tabel met een kolom `rol`**, bijvoorbeeld `profielen (id uuid references auth.users, rol text)`. Eén plek voor alle rollen; dit is de meest gebruikte aanpak.
2. **Een tabel per rol.** De tabel `arts` werkt al zo (via `arts.user_id`). Voor receptionisten maak je dan bijvoorbeeld een tabel `receptionisten`.
3. **In de `app_metadata` van de gebruiker in Supabase Auth.** Alleen de server kan die aanpassen. Gebruik hiervoor níet de `user_metadata`: die kan een gebruiker zelf wijzigen, en dan kan iedereen zichzelf receptionist maken.

Kies er één, maak de tabel of kolom aan in Supabase, en leg in je README uit waarom je voor deze aanpak hebt gekozen.

**Koppel gebruikers via hun unieke id aan Supabase Auth.** Elke gebruiker heeft een id in `auth.users`. In SQL is dat `auth.uid()`, in Next.js `claims.sub`. Kijk hoe `arts.user_id` en de trigger `maak_arts_na_registratie` in de migratie `auth_basis` dit doen.

Let op: die trigger maakt nu van elke nieuwe gebruiker een tandarts. Pas dit aan voor jouw rollen. Bedenk ook wie er bepaalt dat iemand receptionist is. Het registratieformulier is daar geen goede plek voor, want dan kan iedereen die rol kiezen. Voor je testaccounts kun je de rol met SQL in de SQL Editor zetten.

**Bepaal op basis van de rol welke functionaliteit beschikbaar is.** Een receptionist moet bijvoorbeeld afspraken kunnen aanmaken voor een tandarts. Een tandarts ziet alleen zijn eigen afspraken op `/mijn-afspraken`.

### Stap 4. Row Level Security implementeren

RLS staat nog uit op alle tabellen. Dat stel je zelf in, in Supabase: via **Table Editor** (per tabel *Enable RLS*), **Authentication > Policies** of de **SQL Editor**.

Kijk eerst wat er gebeurt:

1. Zet RLS aan op `behandelingen`, `arts`, `beschikbaarheid` en `reserveringen`, nog zonder policies.
2. Open `/afspraken/maken/bleken` en log in als arts. Wat zie je, en waarom?
3. De functies `beschikbare_tijden()` en `boek_afspraak()` werken nog wel. Probeer ze maar eens in de SQL Editor met de rol `anon`. Waarom werken die wel? Kijk daarvoor naar `security definer` in de migratie `auth_basis`.

Schrijf daarna de policies, zodat de applicatie weer werkt en elke rol precies krijgt wat je in stap 1 hebt bepaald.

1. Schrijf minimaal drie verschillende RLS-policies die bepalen welke gegevens een gebruiker mag benaderen. Gebruik hierbij:
   - `auth.uid()` om de ingelogde gebruiker te identificeren;
   - `USING` om te bepalen welke bestaande rijen toegankelijk zijn;
   - `WITH CHECK` om te bepalen welke gegevens toegevoegd of gewijzigd mogen worden.
2. Zorg dat de policies aansluiten op de rollen en toegangsrechten uit stap 1. Vergeet de bezoeker niet: die moet de behandelingen kunnen lezen.

Tips:
- **Van gebruiker naar arts:** in `beschikbaarheid` en `reserveringen` staat geen `user_id`, maar een `arts_id`. Hoe kom je van de ingelogde gebruiker naar zijn `arts_id`?
- **Rol controleren:** moet je in meerdere policies de rol controleren? Maak dan een functie, bijvoorbeeld `public.heeft_rol(rol text)`. Doet een policy op je rollentabel een query op diezelfde tabel, dan krijg je een fout over *infinite recursion*. Zet zo'n functie daarom op `security definer` met `set search_path = ''`.
- **Bewaar je SQL.** Wat je in de SQL Editor uitvoert, staat niet in je repository. Zet de SQL van je rollen en policies daarom ook in een nieuw bestand in `supabase/migrations/`, zodat iemand anders je database kan nabouwen.

### Stap 5. Toegangsrechten testen

Test je applicatie met minimaal twee verschillende gebruikersaccounts. Controleer bijvoorbeeld:

- Kan een tandarts de juiste afspraken bekijken, en die van een collega niet?
- Kan een receptionist een nieuwe afspraak toevoegen?
- Kan een gebruiker gegevens bekijken waarvoor hij geen toestemming heeft?
- Wat gebeurt er als een gebruiker niet is ingelogd?
- Wat gebeurt er als een gebruiker gegevens probeert te wijzigen waarvoor hij geen rechten heeft?

**Belangrijk:** test niet alleen of knoppen of pagina's verborgen zijn, maar ook of Supabase ongeautoriseerde databasebewerkingen daadwerkelijk tegenhoudt. De publishable key staat in de JavaScript van je site; iedereen kan daarmee rechtstreeks de database aanspreken, buiten je knoppen en pagina's om.

Zo test je dat:
- Probeer het ook vóórdat je RLS aanzet (stap 4): wat kan een bezoeker dan allemaal lezen?
- In de **SQL Editor** van Supabase kies je rechtsboven een rol (`anon` voor een bezoeker, `authenticated` voor een ingelogde gebruiker) en eventueel een gebruiker. Je queries draaien dan alsof die gebruiker is ingelogd. Probeer een `select`, `insert`, `update` en `delete` die niet mag.
- Haal tijdelijk het filter `.eq("arts_id", artsId)` weg in `getAfsprakenVanArts()` (`lib/afspraken.ts`). Ziet een tandarts dan ineens afspraken van collega's? Dan doen je policies hun werk niet.

### Stap 6. Foutafhandeling

Zorg dat je applicatie op een begrijpelijke manier omgaat met authenticatie- en autorisatiefouten, bijvoorbeeld bij:

- **Ongeldige inloggegevens.** Supabase Auth geeft bij een fout een `error.code` terug, zoals `invalid_credentials`, `email_not_confirmed`, `user_already_exists` of `weak_password`. Alle codes staan in de [lijst met foutcodes van Supabase Auth](https://supabase.com/docs/guides/auth/debugging/error-codes). Gebruik `error.code` en niet `error.message`: die is Engelstalig en kan per versie veranderen. `loginFoutmelding()` in `app/inloggen/actions.ts` en `registratieFout()` in `app/registreren/actions.ts` laten zien hoe je een code vertaalt naar een Nederlandse melding.
- **Een gebruiker die niet is ingelogd.** Stuur hem door naar `/inloggen`, zoals `vereisIngelogdeArts()` doet.
- **Onvoldoende rechten.** RLS reageert niet altijd met een foutmelding:

  | Actie | Wat RLS doet als het niet mag |
  |---|---|
  | `select` | Geen fout: je krijgt alleen de rijen die je mag zien (soms een lege lijst). |
  | `insert`, of een `update` die `WITH CHECK` schendt | Fout met code `42501`: *new row violates row-level security policy*. |
  | `update` of `delete` op rijen die je niet mag zien | Geen fout: er wordt niets aangepast (0 rijen). |

  Vang code `42501` af en toon een begrijpelijke melding. Controleer bij een `update` of `delete` of er echt iets is veranderd, bijvoorbeeld met `.select()` achter je query.

## Inleveren

Lever de volgende onderdelen in:

1. Een link naar je GitHub-repository met de uitgebreide Next.js-applicatie.
2. Een overzicht van de gebruikersrollen en bijbehorende toegangsrechten. Vul daarvoor de sectie [Rollen en toegangsrechten](#rollen-en-toegangsrechten) hieronder in, in deze README.

## Rollen en toegangsrechten

*In te vullen. De eerste rij is een voorbeeld.*

| Rol                      | Tabel             | Lezen        | Toevoegen    | Wijzigen     | Verwijderen  |
|--------------------------|-------------------|--------------|--------------|--------------|--------------|
| Bezoeker (niet ingelogd) | `behandelingen`   | alle rijen   | –            | –            | –            |
| Tandarts                 | `reserveringen`   | van zichzelf | -            | -            | -            |
| Receptionist             | `reserveringen`   | alle rijen   | alle rijen   | alle rijen   | alle rijen   |
| Tandarts                 | `beschikbaarheid` | van zichzelf | van zichzelf | van zichzelf | van zichzelf |
| Receptionist             | `beschikbaarheid` | alle rijen   | alle rijen   | alle rijen   | alle rijen   |
| Tandarts                 | `behandelingen`   | alle rijen   | -            | -            | -            |
| Receptionist             | `behandelingen`   | alle rijen   | alle rijen   | alle rijen   | alle rijen   |
| Tandarts                 | `arts`            | van zichzelf | -            | van zichzelf | -            |
| Receptionist             | `arts`            | alle rijen   | alle rijen   | alle rijen   | alle rijen   |

**Hoe sla ik de rollen op, en waarom zo?**

*Een tabel per rol. In dit geval praktisch, omdat de artsen-tabel ook al volgens deze logica gebouwd is. Daarnaast is het aantal in te bouwen rollen nu beperkt, waardoor het geheel alsnog overzichtelijk blijft.*

**Welke policies heb ik geschreven, en welke regel uit de tabel dwingt elke policy af?** (Verwijs naar je SQL in `supabase/migrations/`.)

*In te vullen.*

---

## Naslag

### Een account koppelen aan een arts uit de seed

Bij registratie maakt de database een nieuwe, lege arts aan. Wil je inloggen als een arts uit de seed (met beschikbaarheid)? Registreer dan eerst en voer daarna in de SQL Editor uit:

```sql
begin;
delete from public.arts
where user_id = (select id from auth.users where email = 'jouw@email.nl');

update public.arts
set user_id = (select id from auth.users where email = 'jouw@email.nl')
where naam = 'Dr. S. Jansen';
commit;
```

### Structuur

| Bestand | Verantwoordelijkheid |
|---|---|
| `supabase/migrations/20261020120000_auth_basis.sql` | Koppeling tussen arts en account (`arts.user_id`), de registratie-trigger en de functies voor bezoekers. Zet de SQL van jouw rollen en policies in een nieuw bestand ernaast. |
| `proxy.ts` + `lib/supabase/proxy.ts` | Ververst de sessie-cookies voordat een pagina rendert |
| `lib/supabase/server.ts` | Client mét de sessie van de gebruiker (voor inloggen en beveiligde data) |
| `lib/supabase/public.ts` | Client zonder sessie (voor openbare data, ook tijdens `next build`) |
| `lib/auth.ts` | Wie is er ingelogd? `vereisIngelogdeArts()` voor beveiligde pagina's |
| `app/inloggen`, `app/registreren` | Formulieren en Server Actions voor inloggen, uitloggen en registreren |
| `app/auth/callback/route.ts` | Verwerkt de link uit de bevestigingsmail |
| `app/mijn-afspraken/page.tsx` | Overzicht van de afspraken van de ingelogde arts |
