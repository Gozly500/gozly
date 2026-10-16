"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MenuAdmin from "@/components/admin/MenuAdmin";

const COULEURS = [
  { id: "bleu", hex: "#2a38ea", nom: "Bleu" },
  { id: "vert", hex: "#3c8000", nom: "Vert" },
  { id: "jaune", hex: "#f5b800", nom: "Jaune" },
  { id: "rouge", hex: "#e5232e", nom: "Rouge" },
  { id: "gris", hex: "#6b7280", nom: "Gris" },
];

async function jeton(ref) {
  // getSession peut rester bloqué (verrou d'auth) : on retombe sur le dernier jeton connu.
  const token = await Promise.race([
    supabase.auth.getSession().then(({ data: { session } }) => session?.access_token || null),
    new Promise((resolve) => setTimeout(() => resolve(ref.current), 3000)),
  ]);
  if (token) ref.current = token;
  return token;
}

// Envoyer un message de Gozlyx dans un salon du serveur Discord (annonce, rappel, nouveauté...).
export default function AnnoncesSection() {
  const tokenRef = useRef(null);
  const [donnees, setDonnees] = useState({ chargement: true, configure: true, salons: [], roles: [], erreur: "" });
  const [canalId, setCanalId] = useState(null);
  const [mode, setMode] = useState("embed");
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [couleur, setCouleur] = useState("bleu");
  const [image, setImage] = useState("");
  const [mention, setMention] = useState("aucune");
  const [envoi, setEnvoi] = useState({ occupe: false, ok: false, message: "", url: "" });

  useEffect(() => {
    (async () => {
      const token = await jeton(tokenRef);
      try {
        const res = await fetch("/api/admin/discord-messages", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
        setDonnees({ chargement: false, configure: json.configure !== false, salons: json.salons || [], roles: json.roles || [], erreur: "" });
      } catch (e) {
        setDonnees((d) => ({ ...d, chargement: false, erreur: e.message }));
      }
    })();
  }, []);

  const optionsSalons = donnees.salons.map((s) => ({ id: s.id, nom: `# ${s.nom}`, groupe: s.categorie || "Sans catégorie" }));
  const optionsMention = [
    { id: "aucune", nom: "Aucune mention" },
    { id: "everyone", nom: "@everyone (tout le monde)" },
    { id: "here", nom: "@here (membres en ligne)" },
    ...donnees.roles.map((r) => ({ id: r.id, nom: `@${r.nom}`, groupe: "Rôles" })),
  ];
  const salon = donnees.salons.find((s) => s.id === canalId);
  const nomMention = mention === "everyone" ? "@everyone" : mention === "here" ? "@here" : optionsMention.find((o) => o.id === mention)?.nom;
  const hex = COULEURS.find((c) => c.id === couleur)?.hex;

  async function envoyer(e) {
    e.preventDefault();
    if (!canalId) return setEnvoi({ occupe: false, ok: false, message: "Choisis un salon.", url: "" });
    if (!texte.trim()) return setEnvoi({ occupe: false, ok: false, message: "Écris le message.", url: "" });
    const fort = mention === "everyone" || mention === "here";
    if (!window.confirm(`Envoyer ce message dans #${salon?.nom}${fort ? ` en mentionnant ${nomMention}` : ""} ?`)) return;
    setEnvoi({ occupe: true, ok: false, message: "", url: "" });
    try {
      const token = await jeton(tokenRef);
      const res = await fetch("/api/admin/discord-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ canalId, mode, titre, texte, couleur, image, mention }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setEnvoi({ occupe: false, ok: true, message: `Message envoyé dans #${json.salon}.`, url: json.url });
      setTitre("");
      setTexte("");
      setImage("");
      setMention("aucune");
    } catch (err) {
      setEnvoi({ occupe: false, ok: false, message: err.message, url: "" });
    }
  }

  if (donnees.chargement) return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;

  return (
    <div>
      <h2>Annonces</h2>
      <p className="panel-hint">Envoie un message de Gozlyx dans le salon de ton choix : annonce, nouveauté, rappel...</p>

      {!donnees.configure && (
        <div className="admin-empty">
          Discord n'est pas encore relié : ajoute la variable <code>DISCORD_GUILD_ID</code> dans Vercel, puis redéploie.
        </div>
      )}
      {donnees.erreur && <div className="admin-empty">Erreur : {donnees.erreur}</div>}

      {donnees.configure && !donnees.erreur && (
        <form onSubmit={envoyer} style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "620px" }}>
          <div>
            <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
              Salon
            </div>
            <MenuAdmin options={optionsSalons} value={canalId} onChange={setCanalId} placeholder="Choisir un salon..." />
          </div>

          <div>
            <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
              Présentation
            </div>
            <div className="settings-nav" style={{ flexDirection: "row", width: "fit-content" }}>
              <button type="button" className={`settings-nav-item${mode === "embed" ? " active" : ""}`} style={{ whiteSpace: "nowrap" }} onClick={() => setMode("embed")}>
                Message encadré
              </button>
              <button type="button" className={`settings-nav-item${mode === "texte" ? " active" : ""}`} style={{ whiteSpace: "nowrap" }} onClick={() => setMode("texte")}>
                Texte simple
              </button>
            </div>
          </div>

          <input type="text" value={titre} maxLength={256} onChange={(e) => setTitre(e.target.value)} placeholder="Titre (facultatif)" />
          <textarea
            value={texte}
            maxLength={mode === "embed" ? 4000 : 1900}
            rows={6}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Message (tu peux utiliser **gras**, *italique* et les liens, comme dans Discord)"
          />

          {mode === "embed" && (
            <>
              <div>
                <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
                  Couleur de la bande
                </div>
                <div className="annonce-couleurs">
                  {COULEURS.map((c) => (
                    <button key={c.id} type="button" title={c.nom} className={`annonce-couleur${couleur === c.id ? " actif" : ""}`} style={{ background: c.hex }} onClick={() => setCouleur(c.id)} />
                  ))}
                </div>
              </div>
              <input type="text" value={image} onChange={(e) => setImage(e.target.value)} placeholder="Image (lien https://..., facultatif)" />
            </>
          )}

          <div>
            <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
              Mention
            </div>
            <MenuAdmin options={optionsMention} value={mention} onChange={setMention} />
          </div>

          {(texte || titre) && (
            <div>
              <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
                Aperçu
              </div>
              <div className={`annonce-apercu${mode === "texte" ? " texte" : ""}`} style={mode === "embed" ? { borderLeftColor: hex } : undefined}>
                {mention !== "aucune" && <div className="annonce-apercu-mention">{nomMention}</div>}
                {titre && <div className="annonce-apercu-titre">{titre}</div>}
                <div className="annonce-apercu-texte">{texte}</div>
                {mode === "embed" && image && /^https:\/\/\S+$/.test(image) && <img className="annonce-apercu-image" src={image} alt="" />}
                {mode === "embed" && <div className="annonce-apercu-pied">Gozlyx • Gozly</div>}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <button type="submit" className="btn-small" disabled={envoi.occupe}>
              {envoi.occupe ? "Envoi..." : "Envoyer dans Discord"}
            </button>
            {envoi.message && (
              <span className={`settings-msg ${envoi.ok ? "ok" : "err"}`} style={{ margin: 0 }}>
                {envoi.message}{" "}
                {envoi.url && (
                  <a href={envoi.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                    Voir
                  </a>
                )}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
