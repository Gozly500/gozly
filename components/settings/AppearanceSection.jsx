"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ThemeGrids from "@/components/ThemeGrids";
import { THEME_SOBRE, DEFAULT_THEME, THEME_STORAGE_KEY, THEME_COULEUR_STORAGE_KEY, isValidTheme } from "@/lib/themes";

export default function AppearanceSection({ profil, setProfil }) {
  const [theme, setThemeState] = useState(profil?.theme || DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleSelect(id) {
    if (id === theme || !profil || saving) return;

    const previous = theme;
    setThemeState(id);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("profils").update({ theme: id }).eq("id", profil.id);

    setSaving(false);

    if (error) {
      setThemeState(previous);
      setMsg({ type: "err", text: "Le changement de thème a échoué. Réessaie dans un instant." });
      return;
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
      if (id !== THEME_SOBRE) window.localStorage.setItem(THEME_COULEUR_STORAGE_KEY, id);
    } catch {}

    setProfil({ ...profil, theme: id });
    setMsg({ type: "ok", text: "Thème appliqué au tableau de bord !" });
    setTimeout(() => setMsg(null), 3000);
  }

  const sobre = theme === THEME_SOBRE;

  // Case "Couleur" : décochée = mode sobre ; recochée = dernier thème coloré.
  function handleToggleCouleur(couleur) {
    if (couleur) {
      let dernier = null;
      try {
        dernier = window.localStorage.getItem(THEME_COULEUR_STORAGE_KEY);
      } catch {}
      handleSelect(isValidTheme(dernier) && dernier !== THEME_SOBRE ? dernier : DEFAULT_THEME);
    } else {
      handleSelect(THEME_SOBRE);
    }
  }

  return (
    <div>
      <h2>Apparence</h2>
      <p className="panel-hint">Choisis le thème visuel de ton tableau de bord.</p>

      <label className="switch-row" style={{ cursor: "pointer", marginBottom: "18px" }}>
        <span className="switch-row-text">
          <h4>Couleur</h4>
          <p>Décoche pour un affichage sobre, sans couleur de fond : Sombre ou Clair.</p>
        </span>
        <input type="checkbox" checked={!sobre} disabled={saving} onChange={(e) => handleToggleCouleur(e.target.checked)} />
      </label>

      <ThemeGrids theme={theme} onSelect={handleSelect} disabled={saving} />

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
    </div>
  );
}
