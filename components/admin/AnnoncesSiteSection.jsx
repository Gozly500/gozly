"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MenuAdmin from "@/components/admin/MenuAdmin";

async function jeton(ref) {
  // getSession peut rester bloqué (verrou d'auth) : on retombe sur le dernier jeton connu.
  const token = await Promise.race([
    supabase.auth.getSession().then(({ data: { session } }) => session?.access_token || null),
    new Promise((resolve) => setTimeout(() => resolve(ref.current), 3000)),
  ]);
  if (token) ref.current = token;
  return token;
}

const formatDate = (iso) => new Date(iso).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });
const VIDE = { id: null, titre: "", contenu: "", publie: true, imageUrl: "" };

// Annonces du site (page publique /annonces) : on les écrit ici une seule fois, et on peut les envoyer aussi dans Discord.
export default function AnnoncesSiteSection() {
  const tokenRef = useRef(null);
  const entreeFichier = useRef(null);
  const [etat, setEtat] = useState({ chargement: true, annonces: [], discordConfigure: false, canalParDefaut: null, erreur: "" });
  const [salons, setSalons] = useState([]);
  const [form, setForm] = useState(VIDE);
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState("");
  const [retirerImage, setRetirerImage] = useState(false);
  const [versDiscord, setVersDiscord] = useState(false);
  const [canal, setCanal] = useState(null);
  const [envoi, setEnvoi] = useState({ occupe: false, ok: false, message: "" });

  const charger = useCallback(async () => {
    const token = await jeton(tokenRef);
    if (!token) return setEtat((e) => ({ ...e, chargement: false, erreur: "Session introuvable : reconnecte-toi." }));
    try {
      const res = await fetch("/api/admin/annonces", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setEtat({ chargement: false, annonces: json.annonces || [], discordConfigure: !!json.discordConfigure, canalParDefaut: json.canalParDefaut || null, erreur: "" });
      setCanal((c) => c || json.canalParDefaut || null);
      if (json.discordConfigure) {
        const r2 = await fetch("/api/admin/discord-messages", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const j2 = await r2.json().catch(() => ({}));
        if (r2.ok) setSalons(j2.salons || []);
      }
    } catch (e) {
      setEtat((s) => ({ ...s, chargement: false, erreur: e.message }));
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  function choisirFichier(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(f.type)) return setEnvoi({ occupe: false, ok: false, message: "Format non accepté (PNG, JPG, GIF ou WebP)." });
    if (f.size > 4 * 1024 * 1024) return setEnvoi({ occupe: false, ok: false, message: "Image trop lourde (maximum 4 Mo)." });
    if (apercu) URL.revokeObjectURL(apercu);
    setFichier(f);
    setApercu(URL.createObjectURL(f));
    setRetirerImage(false);
    setEnvoi({ occupe: false, ok: false, message: "" });
  }

  function viderImage() {
    if (apercu) URL.revokeObjectURL(apercu);
    setFichier(null);
    setApercu("");
    if (form.imageUrl) setRetirerImage(true);
  }

  function reinitialiser() {
    if (apercu) URL.revokeObjectURL(apercu);
    setForm(VIDE);
    setFichier(null);
    setApercu("");
    setRetirerImage(false);
    setVersDiscord(false);
  }

  function modifier(a) {
    reinitialiser();
    setForm({ id: a.id, titre: a.titre, contenu: a.contenu, publie: a.publie, imageUrl: a.image_url || "" });
    if (a.discord_canal_id) setCanal(a.discord_canal_id);
    setEnvoi({ occupe: false, ok: false, message: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function appeler(donnees, image) {
    const token = await jeton(tokenRef);
    let res;
    if (image) {
      const f = new FormData();
      f.append("donnees", JSON.stringify(donnees));
      f.append("image", image);
      res = await fetch("/api/admin/annonces", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: f });
    } else {
      res = await fetch("/api/admin/annonces", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(donnees),
      });
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
    return json;
  }

  async function enregistrer(e) {
    e.preventDefault();
    if (!form.titre.trim()) return setEnvoi({ occupe: false, ok: false, message: "Écris le titre de l'annonce." });
    setEnvoi({ occupe: true, ok: false, message: "" });
    try {
      const json = await appeler(
        {
          action: form.id ? "modifier" : "creer",
          id: form.id,
          titre: form.titre,
          contenu: form.contenu,
          publie: form.publie,
          retirerImage,
          discord: versDiscord ? { envoyer: true, canalId: canal } : null,
        },
        fichier
      );
      let message = form.id ? "Annonce enregistrée." : form.publie ? "Annonce publiée sur le site." : "Brouillon enregistré.";
      if (json.discord) message += json.discord.erreur ? ` Discord : ${json.discord.erreur}` : json.discord.misAJour ? " Message Discord mis à jour." : " Envoyée aussi dans Discord.";
      setEnvoi({ occupe: false, ok: !json.discord?.erreur, message });
      reinitialiser();
      charger();
    } catch (err) {
      setEnvoi({ occupe: false, ok: false, message: err.message });
    }
  }

  async function envoyerDiscord(a) {
    const cible = a.discord_canal_id || canal || etat.canalParDefaut;
    if (!cible) return setEnvoi({ occupe: false, ok: false, message: "Choisis d'abord un salon Discord (bouton Modifier, option « Envoyer aussi dans Discord »)." });
    try {
      const r = await appeler({ action: "discord", id: a.id, canalId: cible });
      setEnvoi({ occupe: false, ok: true, message: r.misAJour ? "Message Discord mis à jour." : "Annonce envoyée dans Discord." });
      charger();
    } catch (err) {
      setEnvoi({ occupe: false, ok: false, message: err.message });
    }
  }

  async function supprimer(a) {
    if (!window.confirm(`Supprimer l'annonce « ${a.titre} » ? Elle disparaîtra du site${a.discord_message_id ? " et son message Discord sera supprimé" : ""}. Cette action est irréversible.`)) return;
    try {
      await appeler({ action: "supprimer", id: a.id });
      if (form.id === a.id) reinitialiser();
      charger();
    } catch (err) {
      setEnvoi({ occupe: false, ok: false, message: err.message });
    }
  }

  const optionsSalons = salons.map((s) => ({ id: s.id, nom: `# ${s.nom}`, groupe: s.categorie || "Sans catégorie" }));
  const imageAffichee = apercu || (!retirerImage && form.imageUrl) || "";

  if (etat.chargement) return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;

  return (
    <div>
      <h2>Annonces du site</h2>
      <p className="panel-hint">
        Écris une annonce une seule fois : elle apparaît sur la page publique <strong>gozly.net/annonces</strong> et comme bandeau « Dernière annonce » dans le tableau de bord des clients. Tu peux aussi l'envoyer dans Discord.
      </p>

      {etat.erreur && <div className="admin-empty">Erreur : {etat.erreur}</div>}

      {!etat.erreur && (
        <form onSubmit={enregistrer} style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "660px", marginBottom: "36px" }}>
          <h3 style={{ margin: 0 }}>{form.id ? "Modifier l'annonce" : "Nouvelle annonce"}</h3>
          <input type="text" value={form.titre} maxLength={150} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Titre (ex : Nouveau module Températures!)" />
          <textarea
            value={form.contenu}
            rows={8}
            maxLength={6000}
            onChange={(e) => setForm({ ...form, contenu: e.target.value })}
            placeholder={"Texte de l'annonce. Tu peux utiliser **gras**, *italique*, [un lien](https://gozly.net) et des listes (une ligne qui commence par « - »). Une ligne vide sépare les paragraphes."}
          />

          <div>
            <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
              Image (facultatif)
            </div>
            <input ref={entreeFichier} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={choisirFichier} style={{ display: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <button type="button" className="btn-small" onClick={() => entreeFichier.current?.click()}>
                {imageAffichee ? "Changer l'image" : "Choisir une image"}
              </button>
              {imageAffichee && (
                <button type="button" className="admin-icon-btn danger" onClick={viderImage}>
                  Retirer
                </button>
              )}
            </div>
            {imageAffichee && <img src={imageAffichee} alt="" style={{ marginTop: "10px", maxWidth: "260px", maxHeight: "160px", borderRadius: "12px", display: "block" }} />}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
            <span className="switch">
              <input type="checkbox" checked={form.publie} onChange={(e) => setForm({ ...form, publie: e.target.checked })} />
              <span className="switch-track"></span>
              <span className="switch-thumb"></span>
            </span>
            <span>{form.publie ? "Publiée (visible sur le site)" : "Brouillon (invisible sur le site)"}</span>
          </label>

          {etat.discordConfigure && (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                <span className="switch">
                  <input type="checkbox" checked={versDiscord} onChange={(e) => setVersDiscord(e.target.checked)} />
                  <span className="switch-track"></span>
                  <span className="switch-thumb"></span>
                </span>
                <span>Envoyer aussi dans Discord (message de Gozyx avec un lien vers l'annonce)</span>
              </label>
              {versDiscord && <MenuAdmin options={optionsSalons} value={canal} onChange={setCanal} placeholder="Choisir un salon Discord..." />}
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <button type="submit" className="btn-small" disabled={envoi.occupe}>
              {envoi.occupe ? "Enregistrement..." : form.id ? "Enregistrer les changements" : form.publie ? "Publier l'annonce" : "Enregistrer le brouillon"}
            </button>
            {form.id && (
              <button type="button" className="admin-icon-btn" onClick={reinitialiser}>
                Annuler la modification
              </button>
            )}
          </div>
        </form>
      )}

      {envoi.message && (
        <p className={`settings-msg ${envoi.ok ? "ok" : "err"}`} style={{ marginBottom: "16px" }}>
          {envoi.message}
        </p>
      )}

      <div className="admin-list" style={{ maxWidth: "820px" }}>
        {etat.annonces.map((a) => (
          <div className="admin-row" key={a.id} style={{ alignItems: "center" }}>
            <div className="admin-row-main" style={{ flex: 1 }}>
              <div className="admin-row-title">{a.titre}</div>
              <div className="admin-row-sub">
                {formatDate(a.publie_le)}
                {a.discord_message_id ? " · envoyée dans Discord" : ""}
              </div>
            </div>
            <div className="admin-row-controls">
              <span className={`admin-status-pill ${a.publie ? "active" : "inactive"}`}>{a.publie ? "Publiée" : "Brouillon"}</span>
              {a.publie && (
                <a className="admin-icon-btn" href={`/annonces#a-${a.id}`} target="_blank" rel="noopener noreferrer">
                  Voir
                </a>
              )}
              <button type="button" className="admin-icon-btn" onClick={() => modifier(a)}>
                Modifier
              </button>
              {etat.discordConfigure && a.publie && (
                <button type="button" className="admin-icon-btn" onClick={() => envoyerDiscord(a)}>
                  {a.discord_message_id ? "Mettre à jour Discord" : "Envoyer dans Discord"}
                </button>
              )}
              <button type="button" className="admin-icon-btn danger" onClick={() => supprimer(a)}>
                Supprimer
              </button>
            </div>
          </div>
        ))}
        {etat.annonces.length === 0 && !etat.erreur && <div className="admin-empty">Aucune annonce pour l'instant.</div>}
      </div>
    </div>
  );
}
