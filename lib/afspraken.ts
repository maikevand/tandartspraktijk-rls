import "server-only";
import {getSupabasePublic} from "./supabase/public";
import {createSupabaseServerClient} from "./supabase/server";

/**
 * Data-laag voor afspraken.
 *
 * Bezoekers (patiënten) zijn niet ingelogd: vrije tijden en boeken lopen via
 * de publieke client en Postgres-functies die bezoekers mogen aanroepen.
 *
 * De logica voor beschikbaarheid en boeken zit in Postgres-functies
 * (zie supabase/migrations). Daardoor gebeurt "is dit tijdstip vrij?" en
 * "sla de reservering op" in één transactie, en weigert de database zelf
 * dubbele boekingen, ook bij gelijktijdige requests.
 */

export type NieuweAfspraak = {
    behandeling: string; // slug
    datum: string;       // ISO-datum, bijv. "2026-09-12"
    tijd: string;        // "HH:MM"
    naam: string;
    email: string;
};

export type GeboekteAfspraak = {
    id: number;
    datum: string;
    tijd: string;
};

/** Het tijdstip is niet (meer) vrij. */
export class TijdNietBeschikbaarError extends Error {
    constructor() {
        super("Dit tijdstip is niet beschikbaar.");
        this.name = "TijdNietBeschikbaarError";
    }
}

/** De behandeling bestaat niet. */
export class OnbekendeBehandelingError extends Error {
    constructor(slug: string) {
        super(`Onbekende behandeling: ${slug}`);
        this.name = "OnbekendeBehandelingError";
    }
}

export class NietGeautoriseerd extends Error {
    constructor() {
        super("U bent niet gemachtigd.");
        this.name = "NietGeautoriseerd";
    }
}

// Postgres-foutcodes uit boek_afspraak()
const PG_EXCLUSION_VIOLATION = "23P01";
const PG_NO_DATA_FOUND = "P0002";
const PG_INSUFFICIENT_PRIVILEGE = "42501";

export async function getBeschikbareTijden(behandeling: string, datum: string): Promise<string[]> {
    const {data, error} = await getSupabasePublic().rpc("beschikbare_tijden", {
        p_behandeling: behandeling,
        p_datum: datum,
    });

    if (error) {
        throw new Error("Beschikbare tijden ophalen mislukt");
    }
    return data.map((rij) => naarUrenEnMinuten(rij.starttijd));
}

/**
 * @throws {TijdNietBeschikbaarError} als het tijdstip inmiddels bezet is.
 * @throws {OnbekendeBehandelingError} als de behandeling niet bestaat.
 */
export async function boekAfspraak(afspraak: NieuweAfspraak): Promise<GeboekteAfspraak> {
    const {data, error} = await getSupabasePublic().rpc("boek_afspraak", {
        p_behandeling: afspraak.behandeling,
        p_datum: afspraak.datum,
        p_starttijd: afspraak.tijd,
        p_naam: afspraak.naam,
        p_email: afspraak.email,
    });

    if (error) {
        if (error.code === PG_EXCLUSION_VIOLATION) {
            throw new TijdNietBeschikbaarError();
        }
        if (error.code === PG_NO_DATA_FOUND) {
            throw new OnbekendeBehandelingError(afspraak.behandeling);
        }
        if (error.code === PG_INSUFFICIENT_PRIVILEGE) {
            throw new NietGeautoriseerd();
        }
        throw new Error("Afspraak boeken mislukt", {cause: error});
    }

    return {id: data.id, datum: data.datum, tijd: naarUrenEnMinuten(data.starttijd)};
}

/** Postgres geeft "09:30:00" terug; de app werkt met "09:30". */
function naarUrenEnMinuten(tijd: string): string {
    return tijd.slice(0, 5);
}

/** Een afspraak zoals de arts die in zijn overzicht ziet. */
export type ArtsAfspraak = {
    id: number;
    datum: string;     // ISO-datum
    starttijd: string; // "HH:MM"
    eindtijd: string;  // "HH:MM"
    patientNaam: string;
    patientEmail: string;
    behandeling: string;
};

/**
 * Alle afspraken van één arts, oplopend op datum en tijd.
 *
 * Draait met de sessie van de ingelogde gebruiker, dus RLS bepaalt welke
 * rijen er terugkomen. Geef daarnaast altijd het id van de ingelogde arts
 * door (uit lib/auth), nooit een id uit de url of een formulier.
 */
export async function getAfsprakenVanArts(artsId: number): Promise<ArtsAfspraak[]> {
    const supabase = await createSupabaseServerClient();
    const {data, error} = await supabase
        .from("reserveringen")
        .select("id, datum, starttijd, eindtijd, naam, email, behandelingen (type)")
        .eq("arts_id", artsId)
        .order("datum")
        .order("starttijd");

    if (error) {
        throw new Error("Afspraken van arts ophalen mislukt", {cause: error});
    }

    return data.map((rij) => ({
        id: rij.id,
        datum: rij.datum,
        starttijd: naarUrenEnMinuten(rij.starttijd),
        eindtijd: naarUrenEnMinuten(rij.eindtijd),
        patientNaam: rij.naam,
        patientEmail: rij.email,
        behandeling: rij.behandelingen.type,
    }));
}
