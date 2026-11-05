"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { genererCode, secondesRestantes, lireSecretGozly, effacerSecretGozly } from "@/lib/codesGozly";
import { useT } from "@/components/LangProvider";

// « Mes codes » : le code à 6 chiffres de la méthode « App Gozly », à entrer sur l'écran de connexion (dashboard, ordinateur).
// Il change toutes les 30 secondes, comme dans Google Authenticator.
export default function CodesGestion() {
  const { t } = useT();
  const [etat, setEtat] = useState("chargement"); // "chargement" | "aucun" | "actif"
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState("");
  const [reste, setReste] = useState(30);

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

  useEffect(() => {
    if (!secret) return;
    let ignore = false;
    let dernierePeriode = -1;
    async function tic() {
      const maintenant = Date.now();
      setReste(secondesRestantes(maintenant));
      const periode = Math.floor(maintenant / 30000);
      if (periode !== dernierePeriode) {
        dernierePeriode = periode;
        const c = await genererCode(secret, maintenant);
        if (!ignore) setCode(c);
      }
    }
    tic();
    const id = setInterval(tic, 1000);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, [secret]);

  if (etat === "chargement") return <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>;

  if (etat === "aucun") {
    return (
      <div className="gestion-section">
        <Link href="/gestion/parametres" className="retour-parametres">
        ‹ {t("Paramètres")}
      </Link>
      <h2 style={{ marginBottom: "4px" }}>{t("Mes codes")}</h2>
        <p className="section-hint">{t("Aucune méthode « App Gozly » active sur cet appareil.")}</p>
        <p style={{ marginTop: "12px" }}>
          <Link href="/gestion/securite" className="admin-icon-btn da-lien">
            {t("Ouvrir Sécurité")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="gestion-section">
      <Link href="/gestion/parametres" className="retour-parametres">
        ‹ {t("Paramètres")}
      </Link>
      <h2 style={{ marginBottom: "4px" }}>{t("Mes codes")}</h2>
      <p className="section-hint">{t("Entre ce code sur l'écran de connexion de Gozly.")}</p>
      <div className="da-carte da-code-vivant">
        <div className="da-code-grand">{code ? `${code.slice(0, 3)} ${code.slice(3)}` : "--- ---"}</div>
        <div className="da-barre">
          <span style={{ width: `${(reste / 30) * 100}%` }} className={reste <= 5 ? "bientot" : ""} />
        </div>
        <p className="section-hint">{t("Nouveau code dans {n} s", { n: reste })}</p>
      </div>
    </div>
  );
}
