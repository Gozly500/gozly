"use client";

import { useEffect, useState } from "react";
import { lireDemandeDeveloppeur, envoyerDemandeDeveloppeur } from "@/lib/developpeur";
import { useT } from "@/components/LangProvider";

// Paramètres > Développeur : demander un compte développeur, ou voir où en est la demande.
export default function DeveloppeurSection({ user }) {
  const { t } = useT();
  const [demande, setDemande] = useState(undefined); // undefined = lecture en cours
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    lireDemandeDeveloppeur(user.id).then(setDemande);
  }, [user.id]);

  async function demander() {
    setOccupe(true);
    setErreur("");
    const res = await envoyerDemandeDeveloppeur(user.id);
    if (res.erreur) setErreur(t("La demande n'a pas pu être envoyée. Réessaie plus tard."));
    else setDemande({ statut: res.statut });
    setOccupe(false);
  }

  if (demande === undefined) return <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>;

  return (
    <div>
      <h2>{t("Développeur")}</h2>
      {erreur && <p className="settings-msg err">{erreur}</p>}
      {!demande ? (
        <button type="button" className="submit-btn" disabled={occupe} onClick={demander}>
          {occupe ? t("Envoi...") : t("Demander un compte développeur")}
        </button>
      ) : (
        <p className="panel-hint">
          {demande.statut === "approuvee"
            ? t("Ton compte développeur est approuvé.")
            : demande.statut === "refusee"
            ? t("Ta demande de compte développeur n'a pas été retenue.")
            : t("Ta demande est déjà envoyée. Elle est en attente.")}
        </p>
      )}
    </div>
  );
}
