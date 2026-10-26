"use client";

import {useActionState, useState} from "react";
import {type AfspraakResultaat, maakAfspraakAction} from "@/app/afspraken/maken/[behandeling]/actions";
import {useBeschikbareTijden} from "@/hooks/useBeschikbareTijden";
import {dagNaarIsoDatum, formatDatum} from "@/lib/datum";
import AfspraakFormulier from "./AfspraakFormulier";
import Kalender from "./Kalender";
import TijdKeuze from "./TijdKeuze";

const INITIEEL_RESULTAAT: AfspraakResultaat = {status: "idle"};

/**
 * Client Component: alles wat op interactie reageert (selectie, laadstatus,
 * formulierstatus) staat hier. De data en de validatie blijven op de server.
 */
export default function AfspraakPlanner({behandeling}: { behandeling: string }) {
    const [dag, setDag] = useState<number | null>(null);
    const [tijd, setTijd] = useState<string | null>(null);
    const [toonMelding, setToonMelding] = useState(false);
    const beschikbareTijden = useBeschikbareTijden(behandeling);

    const datum = dag === null ? null : dagNaarIsoDatum(dag);

    const [resultaat, formAction, isPending] = useActionState(
        async (vorigResultaat: AfspraakResultaat, formData: FormData) => {
            const nieuwResultaat = await maakAfspraakAction(vorigResultaat, formData);

            const tijdIsWeg = nieuwResultaat.status === "success"
                || (nieuwResultaat.status === "error" && nieuwResultaat.tijdNietBeschikbaar);

            if (tijdIsWeg) {
                // Het gekozen tijdstip is nu bezet: selectie wissen en de lijst verversen.
                setTijd(null);
                const geboekteDatum = formData.get("datum");
                if (typeof geboekteDatum === "string") {
                    void beschikbareTijden.laadTijden(geboekteDatum);
                }
            }

            setToonMelding(true);
            return nieuwResultaat;
        },
        INITIEEL_RESULTAAT
    );

    function kiesDag(nieuweDag: number) {
        setDag(nieuweDag);
        setTijd(null); // een tijd van een andere dag is niet meer geldig
        setToonMelding(false);
        void beschikbareTijden.laadTijden(dagNaarIsoDatum(nieuweDag));
    }

    function kiesTijd(nieuweTijd: string) {
        setTijd(nieuweTijd);
        setToonMelding(false);
    }

    return (
        <>
            <section className="card-container">
                <Kalender geselecteerdeDag={dag} onKiesDag={kiesDag}/>
                <TijdKeuze
                    status={beschikbareTijden.status}
                    tijden={beschikbareTijden.tijden}
                    geselecteerdeTijd={tijd}
                    onKiesTijd={kiesTijd}
                >
                    {datum && tijd && (
                        <h2>U heeft gekozen voor {formatDatum(datum)} om {tijd}.</h2>
                    )}
                </TijdKeuze>
            </section>

            <section>
                <div role="status" aria-live="polite">
                    {toonMelding && <Melding resultaat={resultaat}/>}
                </div>

                {datum && tijd && (
                    <article className="card-container">
                        <AfspraakFormulier
                            behandeling={behandeling}
                            datum={datum}
                            tijd={tijd}
                            action={formAction}
                            isPending={isPending}
                            resultaat={resultaat}
                            toonFouten={toonMelding}
                        />
                    </article>
                )}
            </section>
        </>
    );
}

function Melding({resultaat}: { resultaat: AfspraakResultaat }) {
    switch (resultaat.status) {
        case "idle":
            return null;
        case "success":
            return (
                <p className="form-success">
                    U heeft een afspraak gemaakt
                    voor {formatDatum(resultaat.afspraak.datum)} om {resultaat.afspraak.tijd}.
                </p>
            );
        case "error":
            return <p className="form-error">{resultaat.melding}</p>;
    }
}
