import type {Metadata} from "next";
import Link from "next/link";
import Login from "@/components/login/Login";
import {stuurIngelogdeArtsDoor} from "@/lib/auth";

export const metadata: Metadata = {
    title: "Inloggen | De Tandenborstel",
};

export default async function Inloggen({searchParams}: PageProps<"/inloggen">) {
    await stuurIngelogdeArtsDoor();
    const {fout} = await searchParams;

    return (
        <main className="page-container">
            <section className="login-container">
                <h1>Welkom terug dokter!</h1>
                <p>Log in om je afspraken te beheren.</p>
                {fout === "bevestiging" && (
                    <p className="form-error" role="alert">
                        De bevestigingslink is ongeldig of verlopen. Log in of registreer opnieuw.
                    </p>
                )}
                <Login/>
                <p className="login-wissel">
                    Nog geen account? <Link href="/registreren">Registreren</Link>
                </p>
            </section>
        </main>
    );
}
