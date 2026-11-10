"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SimpleSelect from "@/components/SimpleSelect";
import { rechargerForfaits } from "@/lib/useForfaits";
import { MODULES } from "@/lib/modules";
import { IconFlecheDroite } from "@/components/icons/Pictogrammes";

const PERIODES = [
  { id: "mensuel", label: "Mensuel" },
  { id: "annuel", label: "Annuel" },
];

async function authFetch(corps) {
  const { data: sessionData } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/forfaits", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData?.session?.access_token}` },
    body: JSON.stringify(corps),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function texteLimite(v) {
  return v === null || v === undefined ? "" : String(v);
}

function nombreOuNull(texte) {
  return String(texte).trim() === "" ? null : Number(texte);
}

function pluriel(n, un, plusieurs) {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

function descriptionPrix(p) {
  if (!p) return "introuvable dans Stripe";
  const montant = p.montant != null ? `${p.montant.toLocaleString("fr-CA")} $ ${p.devise}` : "montant inconnu";
  const periode = p.intervalle === "year" ? "par année" : p.intervalle === "month" ? "par mois" : p.intervalle || "";
  return `${montant} ${periode}${p.actif ? "" : " (archivé)"}`.trim();
}

// Résumé d'une ligne : « 3 modules · 1 entreprise · employés illimités ».
export function resume(f) {
  const nbPermis = Array.isArray(f.modules_autorises) ? f.modules_autorises.length : null;
  const modules = f.limite_modules == null ? "modules illimités" : pluriel(f.limite_modules, "module", "modules");
  const permis = nbPermis != null ? ` (parmi ${nbPermis})` : "";
  const entreprises = f.limite_entreprises == null ? "entreprises illimitées" : pluriel(f.limite_entreprises, "entreprise", "entreprises");
  const employes = f.limite_employes == null ? "employés illimités" : pluriel(f.limite_employes, "employé", "employés");
  return `${modules}${permis} · ${entreprises} · ${employes}`;
}

// ---------- Fenêtre générique ----------
function Fenetre({ titre, sousTitre, onClose, children, large }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card abo-fenetre${large ? " large" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{titre}</h3>
          <button type="button" className="admin-icon-btn" onClick={onClose}>
            Fermer
          </button>
        </div>
        {sousTitre && <p className="panel-hint" style={{ marginTop: 0 }}>{sousTitre}</p>}
        {children}
      </div>
    </div>
  );
}

// ---------- Les avantages : limites + modules autorisés ----------
function etatAvantages(f) {
  return {
    modules: texteLimite(f?.limite_modules),
    entreprises: texteLimite(f?.limite_entreprises),
    employes: texteLimite(f?.limite_employes),
    autorises: Array.isArray(f?.modules_autorises) ? f.modules_autorises : MODULES.map((m) => m.id),
  };
}

function corpsAvantages(a) {
  return {
    limite_modules: nombreOuNull(a.modules),
    limite_entreprises: nombreOuNull(a.entreprises),
    limite_employes: nombreOuNull(a.employes),
    modules_autorises: a.autorises,
  };
}

function ChampsAvantages({ valeur, onChange }) {
  const maj = (cle, v) => onChange({ ...valeur, [cle]: v });
  const bascule = (id) =>
    maj("autorises", valeur.autorises.includes(id) ? valeur.autorises.filter((m) => m !== id) : [...valeur.autorises, id]);
  const tous = valeur.autorises.length === MODULES.length;
  return (
    <div className="abo-avantages">
      <div className="abo-champs">
        <div className="field">
          <label>Modules actifs en même temps</label>
          <input type="number" min="0" value={valeur.modules} onChange={(e) => maj("modules", e.target.value)} placeholder="illimité" />
        </div>
        <div className="field">
          <label>Entreprises par compte</label>
          <input type="number" min="0" value={valeur.entreprises} onChange={(e) => maj("entreprises", e.target.value)} placeholder="illimité" />
        </div>
        <div className="field">
          <label>Employés par entreprise</label>
          <input type="number" min="0" value={valeur.employes} onChange={(e) => maj("employes", e.target.value)} placeholder="illimité" />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-dim)" }}>Laisse un champ vide pour illimité.</p>

      <div>
        <div className="abo-cles-titre" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Modules inclus</span>
          <button
            type="button"
            className="abo-lien"
            onClick={() => maj("autorises", tous ? [] : MODULES.map((m) => m.id))}
          >
            {tous ? "Tout décocher" : "Tout cocher"}
          </button>
        </div>
        <div className="abo-modules">
          {MODULES.map((m) => {
            const coche = valeur.autorises.includes(m.id);
            return (
              <button key={m.id} type="button" className={`abo-module${coche ? " actif" : ""}`} onClick={() => bascule(m.id)} aria-pressed={coche}>
                <span className="abo-module-case">{coche ? "✓" : ""}</span>
                {m.nom}
              </button>
            );
          })}
        </div>
        {valeur.autorises.length === 0 && <p className="settings-msg err" style={{ marginTop: "8px" }}>Aucun module inclus : les clients de ce forfait ne pourront rien activer.</p>}
      </div>
    </div>
  );
}

function FenetreAvantages({ forfait, nbComptes, onClose, onFait, onMessage }) {
  const [a, setA] = useState(etatAvantages(forfait));
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  async function enregistrer() {
    setOccupe(true);
    setErreur("");
    const { ok, data } = await authFetch({
      action: "enregistrer",
      id: forfait.id,
      label: forfait.label,
      publique: forfait.publique,
      actif: forfait.actif,
      ordre: forfait.ordre,
      ...corpsAvantages(a),
    });
    setOccupe(false);
    if (!ok) {
      setErreur(data.error || "Échec");
      return;
    }
    onMessage({ type: "ok", text: `Avantages de « ${forfait.label} » enregistrés.` });
    onFait();
    onClose();
  }

  return (
    <Fenetre titre={`Avantages — ${forfait.label}`} sousTitre={nbComptes > 0 ? `Touche ${pluriel(nbComptes, "compte", "comptes")}. Les changements s'appliquent tout de suite.` : null} onClose={onClose}>
      <ChampsAvantages valeur={a} onChange={setA} />
      {erreur && <p className="settings-msg err">{erreur}</p>}
      <div className="abo-actions" style={{ marginTop: "16px" }}>
        <button type="button" className="submit-btn" disabled={occupe} onClick={enregistrer}>
          {occupe ? "..." : "Enregistrer"}
        </button>
        <button type="button" className="admin-icon-btn" disabled={occupe} onClick={onClose}>
          Annuler
        </button>
      </div>
    </Fenetre>
  );
}

// ---------- Les clés de recherche Stripe ----------
function FenetreCles({ forfait, cles, prixStripe, onClose, onFait, onMessage }) {
  const [nouvelleCle, setNouvelleCle] = useState("");
  const [periode, setPeriode] = useState("mensuel");
  const [occupe, setOccupe] = useState(false);

  async function ajouter() {
    if (!nouvelleCle.trim()) return;
    setOccupe(true);
    const { ok, data } = await authFetch({ action: "ajouterCle", forfait_id: forfait.id, cle: nouvelleCle.trim(), periode });
    setOccupe(false);
    if (ok) {
      setNouvelleCle("");
      onMessage(data.avertissement ? { type: "err", text: `Clé ajoutée. ${data.avertissement}` } : { type: "ok", text: "Clé ajoutée." });
      onFait();
    } else {
      onMessage({ type: "err", text: data.error || "Échec" });
    }
  }

  async function retirer(cle) {
    if (!window.confirm(`Retirer la clé « ${cle} » ? Les paiements avec cette clé ne donneront plus ce forfait.`)) return;
    setOccupe(true);
    const { ok, data } = await authFetch({ action: "retirerCle", cle });
    setOccupe(false);
    onMessage(ok ? { type: "ok", text: "Clé retirée." } : { type: "err", text: data.error || "Échec" });
    if (ok) onFait();
  }

  return (
    <Fenetre
      titre={`Clés de recherche — ${forfait.label}`}
      sousTitre="Dans Stripe, donne une clé de recherche à chaque prix. Ajoute-la ici : Gozly saura quel forfait donner à celui qui paie."
      onClose={onClose}
      large
    >
      {cles.length === 0 && <p className="section-hint">Aucune clé : ce forfait ne peut pas être payé par Stripe.</p>}
      {cles.map((c) => {
        const prix = prixStripe[c.cle];
        return (
          <div key={c.cle} className="abo-cle">
            <code>{c.cle}</code>
            <span className="abo-periode">{c.periode === "annuel" ? "annuel" : "mensuel"}</span>
            <span className={`abo-prix${prix ? "" : " manquant"}`}>{descriptionPrix(prix)}</span>
            <button type="button" className="admin-icon-btn danger" disabled={occupe} onClick={() => retirer(c.cle)}>
              Retirer
            </button>
          </div>
        );
      })}
      <div className="abo-cle-ajout">
        <input type="text" value={nouvelleCle} onChange={(e) => setNouvelleCle(e.target.value)} placeholder="ex: opale_annuel" />
        <div style={{ width: "150px" }}>
          <SimpleSelect options={PERIODES} value={periode} onChange={setPeriode} />
        </div>
        <button type="button" className="admin-icon-btn" disabled={occupe || !nouvelleCle.trim()} onClick={ajouter}>
          Ajouter la clé
        </button>
      </div>
    </Fenetre>
  );
}

// ---------- Nouveau forfait (standard ou personnalisé) ----------
function FenetreNouveau({ personnalise, onClose, onFait, onMessage }) {
  const [label, setLabel] = useState("");
  const [a, setA] = useState(etatAvantages(null));
  const [publique, setPublique] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  async function creer() {
    setOccupe(true);
    setErreur("");
    const { ok, data } = await authFetch(
      personnalise
        ? { action: "creerPersonnalise", label, ...corpsAvantages(a) }
        : { action: "enregistrer", label, publique, actif: true, ordre: 100, ...corpsAvantages(a) }
    );
    setOccupe(false);
    if (!ok) {
      setErreur(data.error || "Échec");
      return;
    }
    onMessage({ type: "ok", text: personnalise ? `Abonnement « ${label} » créé. Assigne-le à un client quand tu veux.` : `Forfait « ${label} » créé. Ajoute-lui ses clés de recherche Stripe.` });
    onFait();
    onClose();
  }

  return (
    <Fenetre titre={personnalise ? "Nouvel abonnement personnalisé" : "Nouveau forfait"} onClose={onClose}>
      <div className="field">
        <label>Nom</label>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={personnalise ? "ex: Sur mesure - Restaurant X" : "ex: Rubis"} autoFocus />
      </div>
      <ChampsAvantages valeur={a} onChange={setA} />
      {!personnalise && (
        <label className="abo-case" style={{ marginTop: "14px" }}>
          <input type="checkbox" checked={publique} onChange={(e) => setPublique(e.target.checked)} /> Offert aux clients (page de paiement)
        </label>
      )}
      {erreur && <p className="settings-msg err">{erreur}</p>}
      <div className="abo-actions" style={{ marginTop: "16px" }}>
        <button type="button" className="submit-btn" disabled={occupe || !label.trim()} onClick={creer}>
          {occupe ? "..." : "Créer"}
        </button>
        <button type="button" className="admin-icon-btn" disabled={occupe} onClick={onClose}>
          Annuler
        </button>
      </div>
    </Fenetre>
  );
}

// ---------- Une ligne de forfait (menu déroulant) ----------
function LigneForfait({ forfait, nbComptes, ouvert, onBascule, onFenetre, onChange, onMessage }) {
  const [label, setLabel] = useState(forfait.label);
  const [publique, setPublique] = useState(forfait.publique);
  const [actif, setActif] = useState(forfait.actif);
  const [occupe, setOccupe] = useState(false);

  const modifie = label !== forfait.label || publique !== forfait.publique || actif !== forfait.actif;

  async function enregistrer() {
    setOccupe(true);
    const { ok, data } = await authFetch({
      action: "enregistrer",
      id: forfait.id,
      label,
      limite_modules: forfait.limite_modules,
      limite_entreprises: forfait.limite_entreprises,
      limite_employes: forfait.limite_employes ?? null,
      modules_autorises: Array.isArray(forfait.modules_autorises) ? forfait.modules_autorises : undefined,
      publique,
      actif,
      ordre: forfait.ordre,
    });
    setOccupe(false);
    onMessage(ok ? { type: "ok", text: `« ${label} » enregistré.` } : { type: "err", text: data.error || "Échec" });
    if (ok) onChange();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer le forfait « ${forfait.label} » ? Cette action est définitive.`)) return;
    setOccupe(true);
    const { ok, data } = await authFetch({ action: "supprimer", id: forfait.id });
    setOccupe(false);
    onMessage(ok ? { type: "ok", text: "Forfait supprimé." } : { type: "err", text: data.error || "Échec" });
    if (ok) onChange();
  }

  return (
    <div className={`abo-ligne${ouvert ? " ouvert" : ""}`}>
      <button type="button" className="abo-ligne-tete" onClick={onBascule} aria-expanded={ouvert}>
        <IconFlecheDroite className="gozly-icon-inline abo-chevron" />
        <span className="abo-ligne-nom">{forfait.label}</span>
        {forfait.numero && <code className="abo-numero">{forfait.numero}</code>}
        {!forfait.actif && <span className="admin-status-pill inactive">Désactivé</span>}
        {forfait.publique && <span className="admin-status-pill">Offert</span>}
        <span className="abo-ligne-resume">{resume(forfait)}</span>
        <span className="abo-comptes">{pluriel(nbComptes, "compte", "comptes")}</span>
      </button>

      {ouvert && (
        <div className="abo-ligne-corps">
          <div className="abo-champs">
            <div className="field">
              <label>Nom</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="field">
              <label>Numéro de forfait</label>
              <input type="text" value={forfait.numero || "— (exécute forfaits_avantages.sql)"} readOnly />
            </div>
          </div>

          <div className="abo-interrupteurs">
            {!forfait.personnalise && (
              <label className="abo-case">
                <input type="checkbox" checked={publique} onChange={(e) => setPublique(e.target.checked)} /> Offert aux clients (page de paiement)
              </label>
            )}
            <label className="abo-case">
              <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} /> Actif
            </label>
          </div>

          <div className="abo-actions">
            <button type="button" className="admin-icon-btn" onClick={() => onFenetre({ type: "avantages", forfait })}>
              Avantages
            </button>
            <button type="button" className="admin-icon-btn" onClick={() => onFenetre({ type: "cles", forfait })}>
              Clés de recherche
            </button>
            {modifie && (
              <button type="button" className="submit-btn" disabled={occupe || !label.trim()} onClick={enregistrer}>
                {occupe ? "..." : "Enregistrer"}
              </button>
            )}
            <button
              type="button"
              className="admin-icon-btn danger"
              style={{ marginLeft: "auto" }}
              disabled={occupe || nbComptes > 0}
              title={nbComptes > 0 ? "Change d'abord le forfait de ses comptes" : ""}
              onClick={supprimer}
            >
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AbonnementsSection() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [onglet, setOnglet] = useState("forfaits");
  const [ouverts, setOuverts] = useState([]);
  const [fenetre, setFenetre] = useState(null);

  async function charger() {
    const { ok, data } = await authFetch({ action: "lister" });
    if (!ok) {
      setErreur(data.error || "Impossible de charger les abonnements.");
      return;
    }
    setErreur(null);
    setDonnees(data);
    rechargerForfaits(); // les limites affichées dans l'app suivent
  }

  useEffect(() => {
    charger();
  }, []);

  const standards = useMemo(() => (donnees?.forfaits || []).filter((f) => !f.personnalise), [donnees]);
  const personnalises = useMemo(() => (donnees?.forfaits || []).filter((f) => f.personnalise), [donnees]);

  if (erreur) {
    return (
      <div>
        <h2>Abonnements</h2>
        <p className="settings-msg err">{erreur}</p>
      </div>
    );
  }
  if (!donnees) return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;

  const clesDe = (id) => donnees.cles.filter((c) => c.forfait_id === id);
  const bascule = (id) => setOuverts((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const liste = onglet === "forfaits" ? standards : personnalises;

  // La fenêtre garde le forfait à jour après un rechargement.
  const forfaitFenetre = fenetre?.forfait ? donnees.forfaits.find((f) => f.id === fenetre.forfait.id) || fenetre.forfait : null;

  return (
    <div>
      <h2>Abonnements</h2>

      <div className="page-onglets" style={{ margin: "14px 0 6px" }}>
        <button type="button" className={`page-onglet${onglet === "forfaits" ? " actif" : ""}`} onClick={() => setOnglet("forfaits")}>
          Forfaits ({standards.length})
        </button>
        <button type="button" className={`page-onglet${onglet === "personnalises" ? " actif" : ""}`} onClick={() => setOnglet("personnalises")}>
          Abonnements personnalisés ({personnalises.length})
        </button>
      </div>

      <p className="panel-hint">
        {onglet === "forfaits"
          ? "Les forfaits offerts aux clients. Ouvre-en un pour régler ses avantages et ses clés de recherche Stripe."
          : "Les abonnements créés sur mesure pour un client. Tu peux les modifier ou les supprimer. Pour en assigner un, va sur la fiche du client."}
      </p>

      {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}

      <div className="abo-liste">
        {liste.map((f) => (
          <LigneForfait
            key={f.id + JSON.stringify(f)}
            forfait={f}
            nbComptes={donnees.comptes[f.id] || 0}
            ouvert={ouverts.includes(f.id)}
            onBascule={() => bascule(f.id)}
            onFenetre={setFenetre}
            onChange={charger}
            onMessage={setMessage}
          />
        ))}
        {liste.length === 0 && (
          <div className="admin-empty">{onglet === "forfaits" ? "Aucun forfait pour l'instant." : "Aucun abonnement personnalisé pour l'instant."}</div>
        )}
      </div>

      <button type="button" className="admin-icon-btn" style={{ marginTop: "14px" }} onClick={() => setFenetre({ type: "nouveau", personnalise: onglet === "personnalises" })}>
        {onglet === "forfaits" ? "+ Nouveau forfait" : "+ Nouvel abonnement personnalisé"}
      </button>

      {fenetre?.type === "avantages" && forfaitFenetre && (
        <FenetreAvantages forfait={forfaitFenetre} nbComptes={donnees.comptes[forfaitFenetre.id] || 0} onClose={() => setFenetre(null)} onFait={charger} onMessage={setMessage} />
      )}
      {fenetre?.type === "cles" && forfaitFenetre && (
        <FenetreCles forfait={forfaitFenetre} cles={clesDe(forfaitFenetre.id)} prixStripe={donnees.prixStripe} onClose={() => setFenetre(null)} onFait={charger} onMessage={setMessage} />
      )}
      {fenetre?.type === "nouveau" && (
        <FenetreNouveau personnalise={fenetre.personnalise} onClose={() => setFenetre(null)} onFait={charger} onMessage={setMessage} />
      )}
    </div>
  );
}
