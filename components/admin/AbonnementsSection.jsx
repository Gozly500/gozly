"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SimpleSelect from "@/components/SimpleSelect";
import { rechargerForfaits } from "@/lib/useForfaits";

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

function descriptionPrix(p) {
  if (!p) return "introuvable dans Stripe";
  const montant = p.montant != null ? `${p.montant.toLocaleString("fr-CA")} $ ${p.devise}` : "montant inconnu";
  const periode = p.intervalle === "year" ? "par année" : p.intervalle === "month" ? "par mois" : p.intervalle || "";
  return `${montant} ${periode}${p.actif ? "" : " (archivé)"}`.trim();
}

// Un forfait : nom, limites (vide = illimité), s'il est offert sur le site, et ses clés de recherche Stripe.
function ForfaitCarte({ forfait, cles, nbComptes, prixStripe, onChange, onMessage }) {
  const [label, setLabel] = useState(forfait.label);
  const [modules, setModules] = useState(texteLimite(forfait.limite_modules));
  const [entreprises, setEntreprises] = useState(texteLimite(forfait.limite_entreprises));
  const [publique, setPublique] = useState(forfait.publique);
  const [actif, setActif] = useState(forfait.actif);
  const [nouvelleCle, setNouvelleCle] = useState("");
  const [periode, setPeriode] = useState("mensuel");
  const [occupe, setOccupe] = useState(false);

  const modifie =
    label !== forfait.label ||
    modules !== texteLimite(forfait.limite_modules) ||
    entreprises !== texteLimite(forfait.limite_entreprises) ||
    publique !== forfait.publique ||
    actif !== forfait.actif;

  async function enregistrer() {
    setOccupe(true);
    const { ok, data } = await authFetch({
      action: "enregistrer",
      id: forfait.id,
      label,
      limite_modules: modules.trim() === "" ? null : Number(modules),
      limite_entreprises: entreprises.trim() === "" ? null : Number(entreprises),
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

  async function ajouterCle() {
    if (!nouvelleCle.trim()) return;
    setOccupe(true);
    const { ok, data } = await authFetch({ action: "ajouterCle", forfait_id: forfait.id, cle: nouvelleCle.trim(), periode });
    setOccupe(false);
    if (ok) {
      setNouvelleCle("");
      onMessage(data.avertissement ? { type: "err", text: `Clé ajoutée. ${data.avertissement}` } : { type: "ok", text: "Clé ajoutée." });
      onChange();
    } else {
      onMessage({ type: "err", text: data.error || "Échec" });
    }
  }

  async function retirerCle(cle) {
    if (!window.confirm(`Retirer la clé « ${cle} » ? Les paiements avec cette clé ne donneront plus ce forfait.`)) return;
    setOccupe(true);
    const { ok, data } = await authFetch({ action: "retirerCle", cle });
    setOccupe(false);
    onMessage(ok ? { type: "ok", text: "Clé retirée." } : { type: "err", text: data.error || "Échec" });
    if (ok) onChange();
  }

  return (
    <div className="abo-carte">
      <div className="abo-tete">
        <strong>{forfait.label}</strong>
        <code className="abo-id">{forfait.id}</code>
        {forfait.personnalise && <span className="admin-status-pill">Personnalisé</span>}
        {!forfait.actif && <span className="admin-status-pill">Désactivé</span>}
        <span className="abo-comptes">{nbComptes} compte{nbComptes > 1 ? "s" : ""}</span>
      </div>

      <div className="abo-champs">
        <div className="field">
          <label>Nom</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="field">
          <label>Modules (vide = illimité)</label>
          <input type="number" min="0" value={modules} onChange={(e) => setModules(e.target.value)} placeholder="illimité" />
        </div>
        <div className="field">
          <label>Entreprises (vide = illimité)</label>
          <input type="number" min="0" value={entreprises} onChange={(e) => setEntreprises(e.target.value)} placeholder="illimité" />
        </div>
      </div>

      <div className="abo-interrupteurs">
        <label className="abo-case">
          <input type="checkbox" checked={publique} onChange={(e) => setPublique(e.target.checked)} /> Offert aux clients (page de paiement)
        </label>
        <label className="abo-case">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} /> Actif
        </label>
      </div>

      <div className="abo-cles">
        <div className="abo-cles-titre">Clés de recherche Stripe</div>
        {cles.length === 0 && <p className="section-hint">Aucune clé : ce forfait ne peut pas être payé par Stripe.</p>}
        {cles.map((c) => {
          const prix = prixStripe[c.cle];
          return (
            <div key={c.cle} className="abo-cle">
              <code>{c.cle}</code>
              <span className="abo-periode">{c.periode === "annuel" ? "annuel" : "mensuel"}</span>
              <span className={`abo-prix${prix ? "" : " manquant"}`}>{descriptionPrix(prix)}</span>
              <button type="button" className="admin-icon-btn danger" disabled={occupe} onClick={() => retirerCle(c.cle)}>
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
          <button type="button" className="admin-icon-btn" disabled={occupe || !nouvelleCle.trim()} onClick={ajouterCle}>
            Ajouter la clé
          </button>
        </div>
      </div>

      <div className="abo-actions">
        <button type="button" className="submit-btn" disabled={occupe || !modifie || !label.trim()} onClick={enregistrer}>
          {occupe ? "..." : "Enregistrer"}
        </button>
        {nbComptes === 0 && (
          <button type="button" className="admin-icon-btn danger" disabled={occupe} onClick={supprimer}>
            Supprimer le forfait
          </button>
        )}
      </div>
    </div>
  );
}

export default function AbonnementsSection() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [nouveau, setNouveau] = useState(false);
  const [nLabel, setNLabel] = useState("");
  const [nModules, setNModules] = useState("");
  const [nEntreprises, setNEntreprises] = useState("");
  const [nPublique, setNPublique] = useState(false);
  const [occupe, setOccupe] = useState(false);

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

  async function creer() {
    setOccupe(true);
    const { ok, data } = await authFetch({
      action: "enregistrer",
      label: nLabel,
      limite_modules: nModules.trim() === "" ? null : Number(nModules),
      limite_entreprises: nEntreprises.trim() === "" ? null : Number(nEntreprises),
      publique: nPublique,
      actif: true,
      ordre: 100,
    });
    setOccupe(false);
    if (!ok) {
      setMessage({ type: "err", text: data.error || "Échec" });
      return;
    }
    setMessage({ type: "ok", text: `Forfait « ${nLabel} » créé. Ajoute-lui ses clés de recherche Stripe.` });
    setNouveau(false);
    setNLabel("");
    setNModules("");
    setNEntreprises("");
    setNPublique(false);
    charger();
  }

  if (erreur) {
    return (
      <div>
        <h2>Abonnements</h2>
        <p className="settings-msg err">{erreur}</p>
      </div>
    );
  }
  if (!donnees) return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;

  const standards = donnees.forfaits.filter((f) => !f.personnalise);
  const personnalises = donnees.forfaits.filter((f) => f.personnalise);
  const clesDe = (id) => donnees.cles.filter((c) => c.forfait_id === id);

  return (
    <div>
      <h2>Abonnements</h2>
      <p className="panel-hint">
        Les forfaits, leurs limites et les clés de recherche Stripe. Quand tu crées un prix dans Stripe, donne-lui une clé de recherche et ajoute-la ici
        au bon forfait : Gozly sait alors quel forfait donner à celui qui paie.
      </p>

      {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}

      {standards.map((f) => (
        <ForfaitCarte
          key={f.id + JSON.stringify(f)}
          forfait={f}
          cles={clesDe(f.id)}
          nbComptes={donnees.comptes[f.id] || 0}
          prixStripe={donnees.prixStripe}
          onChange={charger}
          onMessage={setMessage}
        />
      ))}

      {nouveau ? (
        <div className="abo-carte">
          <div className="abo-tete">
            <strong>Nouveau forfait</strong>
          </div>
          <div className="abo-champs">
            <div className="field">
              <label>Nom</label>
              <input type="text" value={nLabel} onChange={(e) => setNLabel(e.target.value)} placeholder="ex: Rubis" />
            </div>
            <div className="field">
              <label>Modules (vide = illimité)</label>
              <input type="number" min="0" value={nModules} onChange={(e) => setNModules(e.target.value)} placeholder="illimité" />
            </div>
            <div className="field">
              <label>Entreprises (vide = illimité)</label>
              <input type="number" min="0" value={nEntreprises} onChange={(e) => setNEntreprises(e.target.value)} placeholder="illimité" />
            </div>
          </div>
          <label className="abo-case">
            <input type="checkbox" checked={nPublique} onChange={(e) => setNPublique(e.target.checked)} /> Offert aux clients (page de paiement)
          </label>
          <div className="abo-actions">
            <button type="button" className="submit-btn" disabled={occupe || !nLabel.trim()} onClick={creer}>
              {occupe ? "..." : "Créer le forfait"}
            </button>
            <button type="button" className="admin-icon-btn" disabled={occupe} onClick={() => setNouveau(false)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="admin-icon-btn" style={{ marginTop: "14px" }} onClick={() => setNouveau(true)}>
          + Nouveau forfait
        </button>
      )}

      {personnalises.length > 0 && (
        <>
          <div className="settings-divider">Forfaits personnalisés (créés depuis la fiche d'un client)</div>
          {personnalises.map((f) => (
            <ForfaitCarte
              key={f.id + JSON.stringify(f)}
              forfait={f}
              cles={clesDe(f.id)}
              nbComptes={donnees.comptes[f.id] || 0}
              prixStripe={donnees.prixStripe}
              onChange={charger}
              onMessage={setMessage}
            />
          ))}
        </>
      )}
    </div>
  );
}
