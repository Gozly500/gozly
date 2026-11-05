"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useGestion } from "@/components/gestion/GestionShell";
import { useT } from "@/components/LangProvider";
import { LANG_COOKIE } from "@/lib/i18n/site";

const LANGUES = [
  { id: "fr", label: "FR" },
  { id: "en", label: "EN" },
];

// Page Paramètres de l'app gestion (comme celle de l'app employé) : tout ce qui concerne le compte est ici,
// y compris la déconnexion.
export default function ParametresGestion() {
  const { t, lang } = useT();
  const router = useRouter();
  const { user, aCodes, plusieursEntreprises } = useGestion();
  const [enregistrement, setEnregistrement] = useState(false);

  async function choisirLangue(id) {
    if (id === lang || enregistrement) return;
    setEnregistrement(true);
    // Sur le compte (suit l'utilisateur d'un appareil à l'autre) et dans le cookie (le serveur rend tout de suite dans la bonne langue).
    if (user?.id) await supabase.from("profils").update({ langue: id }).eq("id", user.id);
    document.cookie = `${LANG_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
    setEnregistrement(false);
  }

  async function deconnexion() {
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login?retour=/gestion");
  }

  return (
    <div>
      <h2>{t("Paramètres")}</h2>

      <div className="moi-settings-list">
        <button type="button" className="moi-settings-item" onClick={() => router.push("/gestion/securite")}>
          <span className="moi-settings-item-emoji">🔒</span>
          <span className="moi-settings-item-text">
            <strong>{t("Sécurité")}</strong>
            <span>{t("Double authentification")}</span>
          </span>
          <span className="moi-settings-item-chevron">›</span>
        </button>

        {aCodes && (
          <button type="button" className="moi-settings-item" onClick={() => router.push("/gestion/codes")}>
            <span className="moi-settings-item-emoji">🔑</span>
            <span className="moi-settings-item-text">
              <strong>{t("Mes codes")}</strong>
              <span>{t("Le code à entrer pour te connecter")}</span>
            </span>
            <span className="moi-settings-item-chevron">›</span>
          </button>
        )}

        <div className="moi-settings-item" style={{ cursor: "default" }}>
          <span className="moi-settings-item-emoji">🌐</span>
          <span className="moi-settings-item-text">
            <strong>{t("Langue")}</strong>
          </span>
          <div style={{ display: "flex", gap: "6px" }}>
            {LANGUES.map((l) => (
              <button
                key={l.id}
                type="button"
                className="admin-icon-btn"
                disabled={enregistrement}
                style={lang === l.id ? { borderColor: "var(--violet)", color: "var(--fg)" } : undefined}
                onClick={() => choisirLangue(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {plusieursEntreprises && (
          <button type="button" className="moi-settings-item" onClick={() => router.push("/dashboards?retour=/gestion")}>
            <span className="moi-settings-item-emoji">🏢</span>
            <span className="moi-settings-item-text">
              <strong>{t("Changer d'entreprise")}</strong>
            </span>
            <span className="moi-settings-item-chevron">›</span>
          </button>
        )}
      </div>

      <button type="button" className="admin-icon-btn danger" style={{ width: "100%", marginTop: "22px" }} onClick={deconnexion}>
        {t("Déconnexion")}
      </button>
    </div>
  );
}
