/* eslint-disable @typescript-eslint/no-unused-vars -- startpunt: deze imports en helpers gebruik je in stap 2. Haal deze regel weg als je klaar bent. */
"use server";

import {redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {leesTekst} from "@/lib/validatie";

export type LoginResultaat =
    | { status: "idle" }
    | { status: "error"; melding: string; email: string };

export async function login(_vorigResultaat: LoginResultaat, formData: FormData): Promise<LoginResultaat> {
    const email = leesTekst(formData, "email").trim().toLowerCase();
    const password = leesTekst(formData, "password");

    if (!email || !password) {
        return {status: "error", melding: "Vul je e-mailadres en wachtwoord in.", email};
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return {
            status: "error",
            melding: loginFoutmelding(error.code),
            email
        };
    }

    redirect("/mijn-afspraken");
}

export async function uitloggen(): Promise<void> {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    redirect("/inloggen");
}

function loginFoutmelding(code: string | undefined): string {
    switch (code) {
        case "invalid_credentials":
            // Bewust niet zeggen wát er fout is: anders kun je uitzoeken welke
            // e-mailadressen een account hebben.
            return "E-mailadres of wachtwoord klopt niet.";
        case "email_not_confirmed":
            return "Bevestig eerst je e-mailadres via de link in de e-mail die je hebt ontvangen.";
        case "over_request_rate_limit":
            return "Te veel pogingen. Wacht even en probeer het opnieuw.";
        default:
            return "Inloggen is niet gelukt. Probeer het later opnieuw.";
    }
}
