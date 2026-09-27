"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ThemeGrids from "@/components/ThemeGrids";
import { THEME_SOBRE, DEFAULT_THEME, THEME_STORAGE_KEY, THEME_COULEUR_STORAGE_KEY, isValidTheme, estSobre, DEFAULT_ACCENT, THEME_ACCENT_STORAGE_KEY, isValidAccent } from "@/lib/themes";

export default function AppearanceSection({ profil, setProfil }) {
  const [theme, setThemeState] = useState(profil?.theme || DEFAULT_THEME);
  const [accent, setAccentState] = useState(isValidAccent(profil?.theme_accent) ? profil.theme_accent : DEFAULT_ACCENT);
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
      if (!estSobre(id)) window.localStorage.setItem(THEME_COULEUR_STORAGE_KEY, id);
    } catch {}

    setProfil({ ...profil, theme: id });
    setMsg({ type: "ok", text: "Thème appliqué au tableau de bord !" });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleSelectAccent(id) {
    if (id === accent || !profil || saving) return;

    const previous = accent;
    setAccentState(id);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("profils")
      .update({ theme_accent: id === DEFAULT_ACCENT ? null : id })
      .eq("id", profil.id);

    setSaving(false);

    if (error) {
      setAccentState(previous);
      setMsg({ type: "err", text: "Le changement de couleur a échoué. Réessaie dans un instant." });
      return;
    }

    try {
      window.localStorage.setItem(THEME_ACCENT_STORAGE_KEY, id);
    } catch {}

    setProfil({ ...profil, theme_accent: id === DEFAULT_ACCENT ? null : id });
    setMsg({ type: "ok", text: "Couleur appliquée au tableau de bord !" });
    setTimeout(() => setMsg(null), 3000);
  }

  const sobre = estSobre(theme);

  // Case "Couleur" : décochée = mode sobre ; recochée = dernier thème coloré.
  function handleToggleCouleur(couleur) {
    if (couleur) {
      let dernier = null;
      try {
        dernier = window.localStorage.getItem(THEME_COULEUR_STORAGE_KEY);
      } catch {}
      handleSelect(isValidTheme(dernier) && !estSobre(dernier) ? dernier : DEFAULT_THEME);
    } else {
      handleSelect(THEME_SOBRE);
    }
  }

  return (
    <div>
      <h2>Apparence</h2>
      <p className="panel-hint">Choisis le thème visuel de ton tableau de bord.</p>

      <div className="switch-row" style={{ marginBottom: "18px" }}>
        <div className="switch-row-text">
          <h4>Couleur</h4>
          <p>Décoche pour un affichage sobre, sans couleur de fond : Sombre ou Clair.</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={!sobre} disabled={saving} onChange={(e) => handleToggleCouleur(e.target.checked)} />
          <span className="switch-track"></span>
          <span className="switch-thumb"></span>
        </label>
      </div>

      <ThemeGrids theme={theme} onSelect={handleSelect} disabled={saving} accent={accent} onSelectAccent={handleSelectAccent} />

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
    </div>
  );
}
