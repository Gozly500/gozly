"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PopupMiseAJour from "@/components/PopupMiseAJour";

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
const VIDE = { id: null, titre: "", contenu: "", cibles: ["employes"], activer: false };
const CIBLES = [
  { id: "employes", nom: "Employés (app Gozly Équipe)" },
  { id: "gestion", nom: "Gestionnaires (tableau de bord et app Gestion)" },
];

// Pop-ups d'ouverture : un message qui s'affiche UNE SEULE FOIS à chaque personne à l'ouverture de l'app (mise à jour, nouveautés,
// communiqué...). Écrit ici, activé / désactivé ici ; « Réafficher » le montre de nouveau à tout le monde.
export default function PopupsAppSection() {
  const tokenRef = useRef(null);
  const [etat, setEtat] = useState({ chargement: true, popups: [], erreur: "" });
  const [form, setForm] = useState(VIDE);
  const [envoi, setEnvoi] = useState({ occupe: false, ok: false, message: "" });
  const [apercu, setApercu] = useState(null);

  const charger = useCallback(async () => {
    const token = await jeton(tokenRef);
    if (!token) return setEtat((e) => ({ ...e, chargement: false, erreur: "Session introuvable : reconnecte-toi." }));
    try {
      const res = await fetch("/api/admin/popups", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setEtat({ chargement: false, popups: json.popups || [], erreur: "" });
    } catch (e) {
      setEtat((s) => ({ ...s, chargement: false, erreur: e.message }));
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function appeler(donnees) {
    const token = await jeton(tokenRef);
    const res = await fetch("/api/admin/popups", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(donnees),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
    return json;
  }

  async function action(donnees, message) {
    setEnvoi({ occupe: true, ok: false, message: "" });
    try {
      await appeler(donnees);
      setEnvoi({ occupe: false, ok: true, message });
      charger();
      return true;
    } catch (err) {
      setEnvoi({ occupe: false, ok: false, message: err.message });
      return false;
    }
  }

  async function enregistrer(e) {
    e.preventDefault();
    const modification = !!form.id;
    const ok = await action(
      { action: modification ? "modifier" : "creer", id: form.id, titre: form.titre, contenu: form.contenu, cibles: form.cibles, activer: form.activer },
      modification ? "Changements enregistrés." : form.activer ? "Pop-up créé et activé : il s'affichera à la prochaine ouverture de l'app." : "Pop-up créé (désactivé). Active-le quand tu es prêt."
    );
    if (ok) setForm(VIDE);
  }

  function modifier(p) {
    setForm({ id: p.id, titre: p.titre, contenu: p.contenu, cibles: p.cibles || ["employes"], activer: false });
    setEnvoi({ occupe: false, ok: false, message: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function basculerCible(id) {
    setForm((f) => ({ ...f, cibles: f.cibles.includes(id) ? f.cibles.filter((c) => c !== id) : [...f.cibles, id] }));
  }

  async function supprimer(p) {
    if (!window.confirm(`Supprimer le pop-up « ${p.titre} » ? Cette action est irréversible.`)) return;
    if (await action({ action: "supprimer", id: p.id }, "Pop-up supprimé.")) {
      if (form.id === p.id) setForm(VIDE);
    }
  }

  async function reafficher(p) {
    if (!window.confirm(`Réafficher « ${p.titre} » à tout le monde ? Les ${p.vus} personne(s) qui l'ont déjà vu le reverront à leur prochaine ouverture de l'app.`)) return;
    await action({ action: "reafficher", id: p.id }, "Il sera de nouveau montré à tout le monde.");
  }

  if (etat.chargement) return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;

  return (
    <div>
      <h2>Pop-ups d'ouverture</h2>
      <p className="panel-hint">
        Un message qui s'affiche <strong>une seule fois</strong> à chaque personne, la prochaine fois qu'elle ouvre l'app (ex : « Gozly a été mis à jour »). Un pop-up reste désactivé tant que tu ne l'actives pas : tu peux le préparer, le voir en aperçu, puis l'activer.
      </p>

      {etat.erreur && <div className="admin-empty">Erreur : {etat.erreur}</div>}

      {!etat.erreur && (
        <form onSubmit={enregistrer} style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "660px", marginBottom: "36px" }}>
          <h3 style={{ margin: 0 }}>{form.id ? "Modifier le pop-up" : "Nouveau pop-up"}</h3>
          <input type="text" value={form.titre} maxLength={120} onChange={(e) => setForm({ ...form, titre: e.target.value })} placeholder="Titre (ex : Gozly a été mis à jour!)" />
          <textarea
            value={form.contenu}
            rows={7}
            maxLength={3000}
            onChange={(e) => setForm({ ...form, contenu: e.target.value })}
            placeholder={"Texte du message. Tu peux utiliser **gras**, *italique*, [un lien](https://gozly.net) et des listes (une ligne qui commence par « - »). Une ligne vide sépare les paragraphes."}
          />

          <div>
            <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
              Qui le voit?
            </div>
            <div className="annonce-roles">
              {CIBLES.map((c) => {
                const actif = form.cibles.includes(c.id);
                return (
                  <button key={c.id} type="button" className={actif ? "actif" : ""} aria-pressed={actif} onClick={() => basculerCible(c.id)}>
                    {c.nom}
                  </button>
                );
              })}
            </div>
          </div>

          {!form.id && (
            <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
              <span className="switch">
                <input type="checkbox" checked={form.activer} onChange={(e) => setForm({ ...form, activer: e.target.checked })} />
                <span className="switch-track"></span>
                <span className="switch-thumb"></span>
              </span>
              <span>{form.activer ? "Activer tout de suite" : "Laisser désactivé (je l'activerai plus tard)"}</span>
            </label>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <button type="submit" className="btn-small" disabled={envoi.occupe}>
              {envoi.occupe ? "Enregistrement..." : form.id ? "Enregistrer les changements" : form.activer ? "Créer et activer" : "Créer le pop-up"}
            </button>
            <button type="button" className="admin-icon-btn" disabled={!form.titre.trim()} onClick={() => setApercu({ id: "apercu", titre: form.titre, contenu: form.contenu })}>
              Aperçu
            </button>
            {form.id && (
              <button type="button" className="admin-icon-btn" onClick={() => setForm(VIDE)}>
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

      <div className="admin-list" style={{ maxWidth: "860px" }}>
        {etat.popups.map((p) => (
          <div className="admin-row" key={p.id} style={{ alignItems: "center" }}>
            <div className="admin-row-main" style={{ flex: 1 }}>
              <div className="admin-row-title">{p.titre}</div>
              <div className="admin-row-sub">
                {(p.cibles || []).map((c) => (c === "employes" ? "Employés" : "Gestionnaires")).join(" + ")} · {formatDate(p.created_at)}
                {p.actif ? ` · vu par ${p.vus} personne(s)` : ""}
              </div>
            </div>
            <div className="admin-row-controls">
              <span className={`admin-status-pill ${p.actif ? "active" : "inactive"}`}>{p.actif ? "Actif" : "Désactivé"}</span>
              <button type="button" className="admin-icon-btn" onClick={() => setApercu({ id: "apercu", titre: p.titre, contenu: p.contenu })}>
                Aperçu
              </button>
              <button type="button" className="admin-icon-btn" onClick={() => modifier(p)}>
                Modifier
              </button>
              <button type="button" className="admin-icon-btn" disabled={envoi.occupe} onClick={() => action({ action: p.actif ? "desactiver" : "activer", id: p.id }, p.actif ? "Pop-up désactivé." : "Pop-up activé : il s'affichera à la prochaine ouverture de l'app.")}>
                {p.actif ? "Désactiver" : "Activer"}
              </button>
              {p.vus > 0 && (
                <button type="button" className="admin-icon-btn" onClick={() => reafficher(p)}>
                  Réafficher
                </button>
              )}
              <button type="button" className="admin-icon-btn danger" onClick={() => supprimer(p)}>
                Supprimer
              </button>
            </div>
          </div>
        ))}
        {etat.popups.length === 0 && !etat.erreur && <div className="admin-empty">Aucun pop-up pour l'instant.</div>}
      </div>

      {apercu && <PopupMiseAJour popups={[apercu]} onVu={() => setApercu(null)} bouton="Fermer l'aperçu" />}
    </div>
  );
}
