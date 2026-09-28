"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { geocoderAdresse } from "@/lib/geocode";
import { listerMesEntreprises, setEntrepriseSelectionnee } from "@/lib/entreprise";
import ThemeGrids from "@/components/ThemeGrids";
import {
  DEFAULT_THEME,
  DEFAULT_ACCENT,
  THEME_SOBRE,
  THEME_STORAGE_KEY,
  THEME_COULEUR_STORAGE_KEY,
  THEME_ACCENT_STORAGE_KEY,
  isValidTheme,
  estSobre,
} from "@/lib/themes";

// Parcours obligatoire juste après la création d'un compte : (1) créer sa
// première entreprise (impossible d'avoir un tableau de bord sans elle),
// puis (2) choisir un thème - histoire de ne pas laisser les gens qui
// détestent le bleu coincés avec le dégradé par défaut sans jamais penser à
// aller fouiller dans Paramètres > Apparence pour le changer.
export default function OnboardingContent() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [checking, setChecking] = useState(true);
  const [etape, setEtape] = useState("entreprise"); // "entreprise" | "apparence"
  const [forfaitVoulu, setForfaitVoulu] = useState(null);
  const [profilId, setProfilId] = useState(null);

  // --- Étape 1 : entreprise ---
  const entrepriseIdRef = useRef(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoApercu, setLogoApercu] = useState(null);
  const [nom, setNom] = useState("");
  const [secteurActivite, setSecteurActivite] = useState("");
  const [adresse, setAdresse] = useState("");
  const [courrielContact, setCourrielContact] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresseIntrouvable, setAdresseIntrouvable] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // --- Étape 2 : apparence ---
  const [theme, setThemeState] = useState(DEFAULT_THEME);
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    if (!entrepriseIdRef.current) entrepriseIdRef.current = crypto.randomUUID();

    const params = new URLSearchParams(window.location.search);
    const f = params.get("forfait");
    if (f) setForfaitVoulu(f);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setProfilId(session.user.id);

      // Déjà au moins une entreprise (onboarding déjà fait dans une session
      // précédente, ou page rouverte par erreur) : pas la peine de repasser
      // par ici.
      const mesEntreprises = await listerMesEntreprises(supabase);
      if (mesEntreprises.length > 0) {
        router.replace(f ? `/parametres?acheter=${f}` : "/dashboard");
        return;
      }

      setChecking(false);
    });
  }, [router]);

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoApercu(URL.createObjectURL(file));
  }

  async function handleCreerEntreprise(e) {
    e.preventDefault();
    if (!nom.trim() || creating) return;

    setCreating(true);
    setError("");
    setAdresseIntrouvable(false);

    const entrepriseId = entrepriseIdRef.current;
    let logoUrl = null;

    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `${entrepriseId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, logoFile, { upsert: true, cacheControl: "3600" });
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(path);
        logoUrl = publicUrlData.publicUrl;
      }
    }

    // Même mécanisme que pour les succursales : l'adresse est convertie en
    // coordonnées GPS via Nominatim (voir lib/geocode.js). Une adresse
    // introuvable n'empêche pas de continuer.
    let position = null;
    if (adresse.trim()) {
      position = await geocoderAdresse(adresse);
      if (!position) setAdresseIntrouvable(true);
    }

    const { error: entrepriseError } = await supabase.from("entreprises").insert({
      id: entrepriseId,
      nom: nom.trim(),
      secteur_activite: secteurActivite.trim() || null,
      adresse: adresse.trim() || null,
      courriel_contact: courrielContact.trim() || null,
      telephone: telephone.trim() || null,
      logo_url: logoUrl,
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
    });

    if (entrepriseError) {
      setCreating(false);
      setError("La création de l'entreprise a échoué. Réessaie dans un instant.");
      return;
    }

    const { error: membreError } = await supabase
      .from("membres")
      .insert({ entreprise_id: entrepriseId, user_id: profilId, role: "proprietaire" });

    setCreating(false);

    if (membreError) {
      setError("L'entreprise a été créée, mais le lien avec ton compte a échoué. Contacte-nous.");
      return;
    }

    setEntrepriseSelectionnee(entrepriseId);
    setEtape("apparence");
  }

  function handleSelectTheme(id) {
    setThemeState(id);
    if (!profilId) return;
    supabase.from("profils").update({ theme: id }).eq("id", profilId);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
      if (!estSobre(id)) window.localStorage.setItem("gozly-theme-couleur", id);
    } catch {}
  }

  function handleSelectAccent(id) {
    setAccentState(id);
    if (!profilId) return;
    supabase.from("profils").update({ theme_accent: id === DEFAULT_ACCENT ? null : id }).eq("id", profilId);
    try {
      window.localStorage.setItem(THEME_ACCENT_STORAGE_KEY, id);
    } catch {}
  }

  // Case "Couleur" : décochée = mode sobre (Sombre/Clair) ; recochée = dernier
  // thème coloré (ou Gozly par défaut, vu qu'on part d'un compte tout neuf).
  function handleToggleCouleur(couleur) {
    if (couleur) {
      let dernier = null;
      try {
        dernier = window.localStorage.getItem(THEME_COULEUR_STORAGE_KEY);
      } catch {}
      handleSelectTheme(isValidTheme(dernier) && !estSobre(dernier) ? dernier : DEFAULT_THEME);
    } else {
      handleSelectTheme(THEME_SOBRE);
    }
  }

  function handleTerminer() {
    router.push(forfaitVoulu ? `/parametres?acheter=${forfaitVoulu}` : "/choisir-forfait");
  }

  if (checking) {
    return <p style={{ color: "var(--text-dim)", textAlign: "center" }}>Chargement...</p>;
  }

  if (etape === "entreprise") {
    return (
      <div className="contact-card">
        <h1 style={{ fontSize: "clamp(26px,4vw,34px)", marginBottom: "8px", textAlign: "center" }}>
          Crée ta première entreprise
        </h1>
        <p className="section-hint" style={{ textAlign: "center", marginBottom: "22px" }}>
          C'est elle qui aura son tableau de bord. Tu pourras en ajouter d'autres plus tard si tu gères plusieurs
          entreprises distinctes.
        </p>

        <form onSubmit={handleCreerEntreprise}>
          <div className="avatar-upload">
            <div className="avatar-preview">
              {logoApercu ? <img src={logoApercu} alt="Logo" /> : (nom || "?").charAt(0).toUpperCase()}
            </div>
            <div className="avatar-actions">
              <button type="button" className="btn-small" onClick={() => fileInputRef.current?.click()}>
                Ajouter un logo
              </button>
              <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Optionnel, tu peux l'ajouter plus tard</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={handleLogoChange}
              />
            </div>
          </div>

          <div className="field-row" style={{ marginTop: "18px" }}>
            <div className="field">
              <label htmlFor="nom-entreprise">Nom de l'entreprise</label>
              <input
                id="nom-entreprise"
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom de l'entreprise"
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="secteur">Secteur d'activité</label>
              <input
                id="secteur"
                type="text"
                value={secteurActivite}
                onChange={(e) => setSecteurActivite(e.target.value)}
                placeholder="Ex: Restauration, Détail..."
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="adresse">Adresse physique</label>
            <input
              id="adresse"
              type="text"
              value={adresse}
              onChange={(e) => {
                setAdresse(e.target.value);
                setAdresseIntrouvable(false);
              }}
              placeholder="123 rue Exemple, Ville, Province"
            />
            {adresseIntrouvable && (
              <p className="section-hint" style={{ color: "#f2b95a", marginTop: "4px" }}>
                ⚠ Adresse introuvable - vérifie l'orthographe. Enregistrée quand même.
              </p>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="courriel">Courriel de contact</label>
              <input
                id="courriel"
                type="email"
                value={courrielContact}
                onChange={(e) => setCourrielContact(e.target.value)}
                placeholder="contact@entreprise.com"
              />
            </div>
            <div className="field">
              <label htmlFor="telephone">Téléphone</label>
              <input
                id="telephone"
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="(514) 000-0000"
              />
            </div>
          </div>

          {error && <p className="settings-msg err">{error}</p>}

          <div className="submit-wrap">
            <button type="submit" className="submit-btn" disabled={creating || !nom.trim()}>
              {creating ? "Création..." : "Continuer"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="contact-card">
      <h1 style={{ fontSize: "clamp(26px,4vw,34px)", marginBottom: "8px", textAlign: "center" }}>
        Personnalise ton expérience
      </h1>
      <p className="section-hint" style={{ textAlign: "center", marginBottom: "22px" }}>
        Choisis l'apparence de ton tableau de bord - tu pourras toujours en changer plus tard dans Paramètres.
      </p>

      <div className="switch-row" style={{ marginBottom: "18px" }}>
        <div className="switch-row-text">
          <h4>Couleur</h4>
          <p>Décoche pour un affichage sobre, sans couleur de fond : Sombre ou Clair.</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={!estSobre(theme)} onChange={(e) => handleToggleCouleur(e.target.checked)} />
          <span className="switch-track"></span>
          <span className="switch-thumb"></span>
        </label>
      </div>

      <ThemeGrids theme={theme} onSelect={handleSelectTheme} accent={accent} onSelectAccent={handleSelectAccent} />

      <div className="submit-wrap" style={{ marginTop: "22px" }}>
        <button type="button" className="submit-btn" onClick={handleTerminer}>
          Continuer
        </button>
      </div>
    </div>
  );
}
