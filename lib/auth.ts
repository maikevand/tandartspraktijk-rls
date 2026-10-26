/* eslint-disable @typescript-eslint/no-unused-vars -- startpunt: deze import gebruik je in stap 2. Haal deze regel weg als je klaar bent. */
import "server-only";
import {cache} from "react";
import {redirect} from "next/navigation";
import {createSupabaseServerClient} from "./supabase/server";

export type Arts = {
    id: number;
    naam: string;
    type: string;
};

export type Receptionist = {
    id: number;
    naam: string;
};

/**
 * Geeft de ingelogde arts terug, of `null` als er niemand is ingelogd.
 *
 * `cache` zorgt dat dit per request maar één keer gebeurt, ook als meerdere
 * onderdelen van een pagina het vragen.
 */
export const getIngelogdeArts = cache(async (): Promise<Arts | null> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        return null
    }

    const artsResultaat = await supabase
        .from("arts")
        .select("id, naam, type")
        .eq("user_id", data.user.id)
        .maybeSingle()

    if (artsResultaat.error || !artsResultaat.data) {
        return null;
    }

    return artsResultaat.data;
});



/** Voor pagina's achter de login: stuurt door naar /inloggen als er niemand is ingelogd. */
export async function vereisIngelogdeArts(): Promise<Arts> {
    const arts = await getIngelogdeArts();
    if (!arts) {
        redirect("/inloggen");
    }
    return arts;
}

export const getIngelogdeReceptionist = cache(async (): Promise<Receptionist| null> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        return null
    }
    const receptionistResultaat = await supabase
        .from("receptionist")
        .select("id, naam")
        .eq("user_id", data.user.id)
        .maybeSingle()

    if (receptionistResultaat.error || !receptionistResultaat.data) {
        return null;
    }

    return receptionistResultaat.data;
});

/** Voor /inloggen en /registreren: wie al is ingelogd, gaat direct naar zijn afspraken. */
export async function stuurIngelogdeArtsDoor(): Promise<void> {
    if (await getIngelogdeArts()) {
        redirect("/mijn-afspraken");
    }
}
