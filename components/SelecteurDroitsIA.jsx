"use client";

import { MODULES_IA } from "@/lib/iaModules";
import { useT } from "@/components/LangProvider";

const LIBELLES = { aucun: "Aucun accès", lecture: "Lecture", ecriture: "Lecture + écriture" };

// Choix des droits d'un assistant IA, module par module : aucun accès, lecture, ou lecture + écriture (là où l'écriture existe).
// Utilisé sur la page d'autorisation (OAuth) et pour les clés manuelles.
export default function SelecteurDroitsIA({ droits, onChange }) {
  const { t } = useT();

  return (
    <div className="ia-droits">
      {MODULES_IA.map((m) => {
        const niveau = droits[m.id] || "aucun";
        const niveaux = m.peutEcrire ? ["aucun", "lecture", "ecriture"] : ["aucun", "lecture"];
        return (
          <div key={m.id} className="ia-droit">
            <div className="ia-droit-tete">
              <strong>{t(m.label)}</strong>
              <div className="ia-niveaux" role="group" aria-label={m.label}>
                {niveaux.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`ia-niveau${niveau === n ? " actif" : ""}`}
                    aria-pressed={niveau === n}
                    onClick={() => onChange({ ...droits, [m.id]: n })}
                  >
                    {t(LIBELLES[n])}
                  </button>
                ))}
              </div>
            </div>
            {niveau !== "aucun" && (
              <p className="section-hint" style={{ margin: 0 }}>
                {t("Peut lire")} : {t(m.lecture)}.
                {niveau === "ecriture" && (
                  <>
                    {" "}
                    {t("Peut aussi")} : {t(m.ecriture)}.
                  </>
                )}
              </p>
            )}
            {!m.peutEcrire && niveau !== "aucun" && (
              <p className="section-hint" style={{ margin: 0 }}>
                {t("Lecture seulement pour ce module.")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
