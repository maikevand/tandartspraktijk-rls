import type {ArtsAfspraak} from "@/lib/afspraken";
import {formatDatumLang} from "@/lib/datum";

type AfsprakenLijstProps = {
    titel: string;
    afspraken: ArtsAfspraak[];
    leegTekst: string;
    /** Toon de meest recente dag bovenaan (handig voor eerdere afspraken). */
    nieuwsteEerst?: boolean;
};

export default function AfsprakenLijst({titel, afspraken, leegTekst, nieuwsteEerst = false}: AfsprakenLijstProps) {
    const dagen = groepeerPerDag(afspraken);
    if (nieuwsteEerst) {
        dagen.reverse();
    }

    return (
        <section className="afspraken-overzicht">
            <h2>{titel} <span className="afspraken-aantal">({afspraken.length})</span></h2>

            {dagen.length === 0 ? (
                <p>{leegTekst}</p>
            ) : (
                dagen.map(([datum, afsprakenOpDag]) => (
                    <article key={datum} className="card afspraken-dag">
                        <h3>
                            <time dateTime={datum}>{formatDatumLang(datum)}</time>
                        </h3>
                        <ul className="afspraken-lijst">
                            {afsprakenOpDag.map((afspraak) => (
                                <li key={afspraak.id}>
                                    <span className="afspraak-tijd">
                                        {afspraak.starttijd} – {afspraak.eindtijd}
                                    </span>
                                    <span className="afspraak-details">
                                        <strong>{afspraak.patientNaam}</strong>
                                        <span>{afspraak.behandeling}</span>
                                    </span>
                                    <a className="afspraak-email" href={`mailto:${afspraak.patientEmail}`}>
                                        {afspraak.patientEmail}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </article>
                ))
            )}
        </section>
    );
}

/** Groepeert afspraken per datum, met behoud van de volgorde. */
function groepeerPerDag(afspraken: ArtsAfspraak[]): [string, ArtsAfspraak[]][] {
    const perDag = new Map<string, ArtsAfspraak[]>();
    for (const afspraak of afspraken) {
        const lijst = perDag.get(afspraak.datum) ?? [];
        lijst.push(afspraak);
        perDag.set(afspraak.datum, lijst);
    }
    return [...perDag.entries()];
}
