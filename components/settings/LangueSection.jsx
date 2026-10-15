"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import { LANG_COOKIE } from "@/lib/i18n/site";

const CHOIX = [
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
];

// Langue du compte : enregistrée sur le profil (colonne `langue`) ET dans le cookie
// de langue, pour que le serveur rende tout de suite dans la bonne langue.
export default function LangueSection({ profil, setProfil }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function choisir(id) {
    if (id === lang || saving) return;
    setSaving(true);
    setMsg(null);

    if (profil) {
      const { error } = await supabase.from("profils").update({ langue: id }).eq("id", profil.id);
      if (error) {
        setSaving(false);
        setMsg({ type: "err", text: t("Le changement de langue a échoué. Réessaie dans un instant.") });
        return;
      }
      setProfil({ ...profil, langue: id });
    }

    document.cookie = `${LANG_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
    setSaving(false);
  }

  return (
    <div className="settings-section" style={{ marginTop: "28px" }}>
      <h3>{t("Langue")}</h3>
      <p className="section-hint">{t("Choisis la langue du site et du tableau de bord.")}</p>
      <div className="forfait-choices">
        {CHOIX.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`forfait-choice${lang === c.id ? " selected" : ""}`}
            disabled={saving}
            onClick={() => choisir(c.id)}
            style={{ textAlign: "left", font: "inherit", color: "inherit" }}
          >
            <span className="forfait-choice-label">{c.label}</span>
          </button>
        ))}
      </div>
      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
    </div>
  );
}
