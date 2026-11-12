"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { envoyerDemandeDeveloppeur } from "@/lib/developpeur";
import { useT } from "@/components/LangProvider";

// Page « Gozly pour développeurs » (lien du pied de page).
//  - pas connecté : créer un compte (marqué développeur) ou se connecter ;
//  - connecté : la demande part tout de suite, sans formulaire.
export default function DeveloppeurContent() {
  const { t } = useT();
  const [etat, setEtat] = useState("chargement"); // chargement | invite | envoye | existe | erreur
  const [statut, setStatut] = useState(null);
  const [nouveauCompte, setNouveauCompte] = useState(false);

  useEffect(() => {
    setNouveauCompte(new URLSearchParams(window.location.search).get("nouveau") === "1");
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setEtat("invite");
        return;
      }
      const res = await envoyerDemandeDeveloppeur(session.user.id);
      if (res.erreur) {
        setEtat("erreur");
        return;
      }
      setStatut(res.statut);
      setEtat(res.nouvelle ? "envoye" : "existe");
    });
  }, []);

  if (etat === "chargement") return <p style={{ color: "var(--text-dim)", textAlign: "center" }}>{t("Chargement...")}</p>;

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", textAlign: "center" }}>
      {etat === "invite" && (
        <>
          <h2>{t("Gozly pour développeurs")}</h2>
          <p className="panel-hint">{t("Crée un compte Gozly et envoie ta demande de compte développeur.")}</p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginTop: "18px" }}>
            <Link href="/inscription?developpeur=1" className="btn-pill-dark">
              {t("Créer un compte")}
            </Link>
            <Link href="/login?retour=/developpeur" className="btn-pill-glass">
              {t("J'ai déjà un compte")}
            </Link>
          </div>
        </>
      )}

      {etat === "envoye" && (
        <>
          <h2>{nouveauCompte ? t("Ton compte Gozly est créé") : t("Demande envoyée")}</h2>
          <p className="panel-hint">{t("Ta demande de compte développeur a été envoyée. On te répond bientôt.")}</p>
          <Link href="/" className="btn-pill-glass" style={{ display: "inline-block", marginTop: "18px" }}>
            {t("Retour à l'accueil")}
          </Link>
        </>
      )}

      {etat === "existe" && (
        <>
          <h2>{t("Compte développeur")}</h2>
          <p className="panel-hint">
            {statut === "approuvee"
              ? t("Ton compte développeur est approuvé.")
              : statut === "refusee"
              ? t("Ta demande de compte développeur n'a pas été retenue.")
              : t("Ta demande est déjà envoyée. Elle est en attente.")}
          </p>
          <Link href="/" className="btn-pill-glass" style={{ display: "inline-block", marginTop: "18px" }}>
            {t("Retour à l'accueil")}
          </Link>
        </>
      )}

      {etat === "erreur" && (
        <>
          <h2>{t("Compte développeur")}</h2>
          <p className="settings-msg err">{t("La demande n'a pas pu être envoyée. Réessaie plus tard.")}</p>
        </>
      )}
    </div>
  );
}
