"use server";

import {boekAfspraak, OnbekendeBehandelingError, TijdNietBeschikbaarError, NietGeautoriseerd} from "@/lib/afspraken";
import {isGeldigeAfspraakDatum} from "@/lib/datum";
import {isGeldigEmail, leesTekst} from "@/lib/validatie";

type Veld = "naam" | "email";

export type AfspraakResultaat =
    | { status: "idle" }
    | { status: "success"; afspraak: { datum: string; tijd: string } }
    | {
    status: "error";
    melding: string;
    /** Foutmeldingen per invoerveld, om direct bij het veld te tonen. */
    veldFouten?: Partial<Record<Veld, string>>;
    /** Wat de gebruiker had ingevuld, zodat het formulier niet leeg raakt. */
    invoer?: Record<Veld, string>;
    /** True als het tijdstip niet (meer) geboekt kan worden: de tijdenlijst moet ververst worden. */
    tijdNietBeschikbaar?: boolean;
};

const NAAM_MAX_LENGTE = 100;
const TIJD_PATROON = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Server Action voor het boeken van een afspraak.
 *
 * Alle invoer wordt hier gevalideerd, ook de verborgen velden: een Server
 * Action is een publiek endpoint en kan met willekeurige FormData worden
 * aangeroepen. De database controleert daarna nog eens of het tijdstip vrij
 * is en weigert dubbele boekingen (zie boek_afspraak in de migratie).
 */
export async function maakAfspraakAction(
    _vorigResultaat: AfspraakResultaat,
    formData: FormData
): Promise<AfspraakResultaat> {
    const behandeling = leesTekst(formData, "behandeling");
    const datum = leesTekst(formData, "datum");
    const tijd = leesTekst(formData, "tijd");
    const invoer = {
        naam: leesTekst(formData, "naam").trim(),
        email: leesTekst(formData, "email").trim(),
    };

    const ongeldigeKeuze: AfspraakResultaat = {
        status: "error",
        melding: "Deze combinatie van behandeling, datum en tijd is niet geldig. Kies opnieuw een moment.",
        invoer,
        tijdNietBeschikbaar: true,
    };

    if (!behandeling || !isGeldigeAfspraakDatum(datum) || !TIJD_PATROON.test(tijd)) {
        return ongeldigeKeuze;
    }

    const veldFouten = valideerContactgegevens(invoer);
    if (veldFouten) {
        return {status: "error", melding: "Controleer de gemarkeerde velden.", veldFouten, invoer};
    }

    // Geen revalidatePath nodig: de pagina bevat geen afspraakdata en de tijden
    // worden in de browser met `no-store` opgehaald en na een boeking ververst.
    try {
        const afspraak = await boekAfspraak({behandeling, datum, tijd, ...invoer});
        return {status: "success", afspraak: {datum: afspraak.datum, tijd: afspraak.tijd}};
    } catch (error) {
        if (error instanceof TijdNietBeschikbaarError) {
            // Iemand anders was net eerder: de lijst in de browser was al verouderd.
            return {
                status: "error",
                melding: "Dit tijdstip is helaas net vergeven. Kies een ander tijdstip.",
                invoer,
                tijdNietBeschikbaar: true,
            };
        }
        if (error instanceof OnbekendeBehandelingError) {
            return ongeldigeKeuze;
        }

        if (error instanceof NietGeautoriseerd) {
            return {
                status: "error",
                melding: error.message,
                invoer,
            };
        }

        console.error(error);
        return {
            status: "error",
            melding: "Er ging iets mis bij het opslaan. Probeer het later opnieuw.",
            invoer,
        };
    }
}

function valideerContactgegevens({naam, email}: Record<Veld, string>): Partial<Record<Veld, string>> | null {
    const fouten: Partial<Record<Veld, string>> = {};

    if (naam.length === 0) {
        fouten.naam = "Vul uw naam in.";
    } else if (naam.length > NAAM_MAX_LENGTE) {
        fouten.naam = `Uw naam mag maximaal ${NAAM_MAX_LENGTE} tekens zijn.`;
    }

    if (!isGeldigEmail(email)) {
        fouten.email = "Vul een geldig e-mailadres in.";
    }

    return Object.keys(fouten).length > 0 ? fouten : null;
}
