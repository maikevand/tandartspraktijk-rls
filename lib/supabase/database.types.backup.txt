/**
 * Types voor het Supabase-schema (supabase/migrations).
 *
 * Dit bestand volgt het formaat van `supabase gen types`. Na een wijziging in
 * het schema kun je het opnieuw genereren met:
 *   npx supabase gen types typescript --project-id <project-id> > lib/supabase/database.types.ts
 */

export type Database = {
    public: {
        Tables: {
            arts: {
                Row: {
                    id: number;
                    user_id: string | null;
                    naam: string;
                    type: string;
                };
                Insert: {
                    id?: never;
                    user_id?: string | null;
                    naam: string;
                    type: string;
                };
                Update: {
                    id?: never;
                    user_id?: string | null;
                    naam?: string;
                    type?: string;
                };
                Relationships: [];
            };
            behandelingen: {
                Row: {
                    id: number;
                    slug: string;
                    type: string;
                    duur: number;
                };
                Insert: {
                    id?: never;
                    slug: string;
                    type: string;
                    duur: number;
                };
                Update: {
                    id?: never;
                    slug?: string;
                    type?: string;
                    duur?: number;
                };
                Relationships: [];
            };
            beschikbaarheid: {
                Row: {
                    id: number;
                    arts_id: number;
                    datum: string;
                    starttijd: string;
                    eindtijd: string;
                };
                Insert: {
                    id?: never;
                    arts_id: number;
                    datum: string;
                    starttijd: string;
                    eindtijd: string;
                };
                Update: {
                    id?: never;
                    arts_id?: number;
                    datum?: string;
                    starttijd?: string;
                    eindtijd?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "beschikbaarheid_arts_id_fkey";
                        columns: ["arts_id"];
                        isOneToOne: false;
                        referencedRelation: "arts";
                        referencedColumns: ["id"];
                    },
                ];
            };
            reserveringen: {
                Row: {
                    id: number;
                    arts_id: number;
                    behandeling_id: number;
                    naam: string;
                    email: string;
                    datum: string;
                    starttijd: string;
                    eindtijd: string;
                    aangemaakt_op: string;
                };
                Insert: {
                    id?: never;
                    arts_id: number;
                    behandeling_id: number;
                    naam: string;
                    email: string;
                    datum: string;
                    starttijd: string;
                    eindtijd: string;
                    aangemaakt_op?: string;
                };
                Update: {
                    id?: never;
                    arts_id?: number;
                    behandeling_id?: number;
                    naam?: string;
                    email?: string;
                    datum?: string;
                    starttijd?: string;
                    eindtijd?: string;
                    aangemaakt_op?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reserveringen_arts_id_fkey";
                        columns: ["arts_id"];
                        isOneToOne: false;
                        referencedRelation: "arts";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "reserveringen_behandeling_id_fkey";
                        columns: ["behandeling_id"];
                        isOneToOne: false;
                        referencedRelation: "behandelingen";
                        referencedColumns: ["id"];
                    },
                ];
            };
        };
        Views: Record<never, never>;
        Functions: {
            beschikbare_tijden: {
                Args: {
                    p_behandeling: string;
                    p_datum: string;
                    p_interval_minuten?: number;
                };
                Returns: {
                    starttijd: string;
                }[];
            };
            boek_afspraak: {
                Args: {
                    p_behandeling: string;
                    p_datum: string;
                    p_starttijd: string;
                    p_naam: string;
                    p_email: string;
                };
                Returns: Database["public"]["Tables"]["reserveringen"]["Row"];
            };
        };
        Enums: Record<never, never>;
        CompositeTypes: Record<never, never>;
    };
};
