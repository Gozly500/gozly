"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { lireSecretGozly, effacerSecretGozly } from "@/lib/codesGozly";
import CodeVivant from "@/components/CodeVivant";
import { useT } from "@/components/LangProvider";

// « Mes codes » : le code à 6 chiffres de la méthode « App Gozly », à entrer sur l'écran de connexion (dashboard, ordinateur).
// Il change toutes les 30 secondes, comme dans Google Authenticator. L'écran de connexion de Gozly l'affiche aussi sur
// l'appareil qui a la clé, pour qu'on ne soit jamais bloqué dehors.
export default function CodesGestion() {
  const { t } = useT();
  const [etat, setEtat] = useState("chargement"); // "chargement" | "aucun" | "actif"
  const [secret, setSecret] = useState(null);

  // Le code existe seulement si la méthode est encore active chez Supabase (l'équipe Gozly a pu la désactiver).
  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess?.session?.user?.id;
      const local = userId ? lireSecretGozly(userId) : null;
      if (!local) {
        if (!ignore) setEtat("aucun");
        return;
      }
      const { data } = await supabase.auth.mfa.listFactors();
      const existe = (data?.all || []).some((f) => f.id === local.factorId && f.status === "verified");
      if (ignore) return;
      if (!existe) {
        effacerSecretGozly(userId);
        setEtat("aucun");
        return;
      }
      setSecret(local.secret);
      setEtat("actif");
    })();
    return () => {
      ignore = true;
    };
  }, []);

  if (etat === "chargement") return <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>;

  return (
    <div className="gestion-section">
      <Link href="/gestion/parametres" className="retour-parametres">
        ‹ {t("Paramètres")}
      </Link>
      <h2 style={{ marginBottom: "4px" }}>{t("Mes codes")}</h2>
      {etat === "aucun" ? (
        <>
          <p className="section-hint">{t("Aucune méthode « App Gozly » active sur cet appareil.")}</p>
          <p style={{ marginTop: "12px" }}>
            <Link href="/gestion/securite" className="admin-icon-btn da-lien">
              {t("Ouvrir Sécurité")}
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="section-hint">{t("Entre ce code sur l'écran de connexion de Gozly.")}</p>
          <div className="da-carte da-code-vivant">
            <CodeVivant secret={secret} />
          </div>
        </>
      )}
    </div>
  );
}
