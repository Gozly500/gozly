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
const VIDE = { id: null, titre: "", contenu: "", cibles: ["employes"], activer: false, debutLe: "", finLe: "", boutonTexte: "", boutonUrl: "", titreEn: "", contenuEn: "", boutonTexteEn: "", avaitAnglais: false };

// Date ISO <-> champ « datetime-local » (heure locale du navigateur).
const versChamp = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
};
const versIso = (champ) => (champ ? new Date(champ).toISOString() : null);

// État affiché d'un pop-up : désactivé / programmé (début dans le futur) / expiré (fin passée) / actif.
function etatPopup(p) {
  if (!p.actif) return { classe: "inactive", texte: "Désactivé" };
  const maintenant = Date.now();
  if (p.debut_le && new Date(p.debut_le).getTime() > maintenant) return { classe: "inactive", texte: "Programmé" };
  if (p.fin_le && new Date(p.fin_le).getTime() < maintenant) return { classe: "inactive", texte: "Expiré" };
  return { classe: "active", texte: "Actif" };
}
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
  const [apercu, setApercu] = useState(null); // { popup, langue }
  const [langueForm, setLangueForm] = useState("fr"); // onglet du formulaire : "fr" | "en"
  const en = langueForm === "en";
  const [cTitre, cContenu, cBouton] = en ? ["titreEn", "contenuEn", "boutonTexteEn"] : ["titre", "contenu", "boutonTexte"];

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
      {
        action: modification ? "modifier" : "creer",
        id: form.id,
        titre: form.titre,
        contenu: form.contenu,
        cibles: form.cibles,
        activer: form.activer,
        debutLe: versIso(form.debutLe),
        finLe: versIso(form.finLe),
        boutonTexte: form.boutonTexte,
        boutonUrl: form.boutonUrl,
        // Version anglaise : envoyée seulement s'il y en a une (ou s'il y en avait une, pour pouvoir l'effacer).
        en: form.titreEn || form.contenuEn || form.boutonTexteEn || form.avaitAnglais ? { titre: form.titreEn, contenu: form.contenuEn, boutonTexte: form.boutonTexteEn } : undefined,
      },
      modification ? "Changements enregistrés." : form.activer ? "Pop-up créé et activé : il s'affichera à la prochaine ouverture de l'app." : "Pop-up créé (désactivé). Active-le quand tu es prêt."
    );
    if (ok) setForm(VIDE);
  }

  function modifier(p) {
    setForm({
      id: p.id,
      titre: p.titre,
      contenu: p.contenu,
      cibles: p.cibles || ["employes"],
      activer: false,
      debutLe: versChamp(p.debut_le),
      finLe: versChamp(p.fin_le),
      boutonTexte: p.bouton_texte || "",
      boutonUrl: p.bouton_url || "",
      titreEn: p.titre_en || "",
      contenuEn: p.contenu_en || "",
      boutonTexteEn: p.bouton_texte_en || "",
      avaitAnglais: !!(p.titre_en || p.contenu_en || p.bouton_texte_en),
    });
    setLangueForm("fr");
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
          <div>
            <div className="annonce-roles">
              <button type="button" className={!en ? "actif" : ""} aria-pressed={!en} onClick={() => setLangueForm("fr")}>
                Français
              </button>
              <button type="button" className={en ? "actif" : ""} aria-pressed={en} onClick={() => setLangueForm("en")}>
                English{form.titreEn ? " ✓" : " (facultatif)"}
              </button>
            </div>
            {en && <p className="aide-note" style={{ marginTop: "8px" }}>Les personnes dont l'app est en anglais verront cette version. Sans version anglaise, elles verront la française.</p>}
          </div>
          <input
            type="text"
            value={form[cTitre]}
            maxLength={120}
            onChange={(e) => setForm({ ...form, [cTitre]: e.target.value })}
            placeholder={en ? "Title (e.g. Gozly has been updated!)" : "Titre (ex : Gozly a été mis à jour!)"}
          />
          <textarea
            value={form[cContenu]}
            rows={7}
            maxLength={3000}
            onChange={(e) => setForm({ ...form, [cContenu]: e.target.value })}
            placeholder={
              en
                ? "Message text. You can use **bold**, *italic*, [a link](https://gozly.net) and lists (a line starting with \"- \"). A blank line separates paragraphs."
                : "Texte du message. Tu peux utiliser **gras**, *italique*, [un lien](https://gozly.net) et des listes (une ligne qui commence par « - »). Une ligne vide sépare les paragraphes."
            }
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

          <div>
            <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
              Période d'affichage (facultatif : sans dates, il s'affiche dès qu'il est actif et jusqu'à ce que tu le désactives)
            </div>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", color: "var(--text-dim)" }}>
                Début
                <input type="datetime-local" value={form.debutLe} onChange={(e) => setForm({ ...form, debutLe: e.target.value })} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", color: "var(--text-dim)" }}>
                Fin
                <input type="datetime-local" value={form.finLe} onChange={(e) => setForm({ ...form, finLe: e.target.value })} />
              </label>
              {(form.debutLe || form.finLe) && (
                <button type="button" className="admin-icon-btn" style={{ alignSelf: "flex-end" }} onClick={() => setForm({ ...form, debutLe: "", finLe: "" })}>
                  Effacer les dates
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
              Bouton de lien (facultatif)
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input type="text" value={form[cBouton]} maxLength={40} onChange={(e) => setForm({ ...form, [cBouton]: e.target.value })} placeholder={en ? "Text (e.g. See what's new)" : "Texte (ex : Voir les nouveautés)"} style={{ flex: "1 1 200px" }} />
              <input type="text" value={form.boutonUrl} maxLength={500} onChange={(e) => setForm({ ...form, boutonUrl: e.target.value })} placeholder="Adresse (https://... ou /moi/demandes)" style={{ flex: "2 1 260px" }} />
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
            <button type="button" className="admin-icon-btn" disabled={!form[cTitre].trim()} onClick={() => setApercu({ langue: langueForm, popup: { id: "apercu", titre: form.titre, contenu: form.contenu, boutonTexte: form.boutonTexte, boutonUrl: form.boutonUrl, titreEn: form.titreEn, contenuEn: form.contenuEn, boutonTexteEn: form.boutonTexteEn } })}>
              {en ? "Aperçu (English)" : "Aperçu"}
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
              <div className="admin-row-title">
                {p.titre}
                {p.titre_en && <span className="admin-status-pill active" style={{ marginLeft: "8px", fontSize: "10.5px" }}>FR + EN</span>}
              </div>
              <div className="admin-row-sub">
                {(p.cibles || []).map((c) => (c === "employes" ? "Employés" : "Gestionnaires")).join(" + ")} · {formatDate(p.created_at)}
                {p.debut_le ? ` · dès le ${formatDate(p.debut_le)}` : ""}
                {p.fin_le ? ` · jusqu'au ${formatDate(p.fin_le)}` : ""}
                {p.actif ? ` · vu par ${p.vus} personne(s)` : ""}
              </div>
            </div>
            <div className="admin-row-controls">
              <span className={`admin-status-pill ${etatPopup(p).classe}`}>{etatPopup(p).texte}</span>
              <button type="button" className="admin-icon-btn" onClick={() => setApercu({ langue: "fr", popup: { id: "apercu", titre: p.titre, contenu: p.contenu, boutonTexte: p.bouton_texte, boutonUrl: p.bouton_url } })}>
                Aperçu
              </button>
              {p.titre_en && (
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => setApercu({ langue: "en", popup: { id: "apercu", titre: p.titre, contenu: p.contenu, boutonTexte: p.bouton_texte, boutonUrl: p.bouton_url, titreEn: p.titre_en, contenuEn: p.contenu_en, boutonTexteEn: p.bouton_texte_en } })}
                >
                  Aperçu EN
                </button>
              )}
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

      {apercu && <PopupMiseAJour popups={[apercu.popup]} langue={apercu.langue} onVu={() => setApercu(null)} bouton={apercu.langue === "en" ? "Close preview" : "Fermer l'aperçu"} etiquette={apercu.langue === "en" ? "What's new" : "Nouveauté"} apercu />}
    </div>
  );
}
