"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

async function authFetch(path, options = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData?.session?.access_token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

const STATUTS = { draft: "Brouillon", open: "Envoyée", paid: "Payée", void: "Annulée", uncollectible: "Irrécouvrable" };
const argent = (cents) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
const ligneVide = () => ({ description: "", quantite: "1", prix: "" });

// Panneau « Créer une facture » d'un compte client : crée une facture Stripe sur mesure et l'envoie par
// courriel avec un lien de paiement en ligne.
export default function FactureCompte({ compte }) {
  const profilId = compte.profil?.id;
  const [lignes, setLignes] = useState([ligneVide()]);
  const [joursEcheance, setJoursEcheance] = useState("30");
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [resultat, setResultat] = useState(null);
  const [factures, setFactures] = useState([]);

  async function chargerFactures() {
    const { ok, data } = await authFetch(`/api/admin/factures?profilId=${profilId}`);
    if (ok) setFactures(data.factures || []);
  }

  useEffect(() => {
    if (profilId) chargerFactures();
  }, [profilId]);

  const majLigne = (i, champ, valeur) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, [champ]: valeur } : l)));
  const sousTotal = lignes.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix) || 0), 0);

  async function envoyer() {
    setEnvoi(true);
    setErreur(null);
    setResultat(null);
    const { ok, data } = await authFetch("/api/admin/factures", {
      method: "POST",
      body: JSON.stringify({ profilId, lignes, joursEcheance, note }),
    });
    setEnvoi(false);
    if (!ok) {
      setErreur(data.error || "L'envoi a échoué.");
      return;
    }
    setResultat(data);
    setLignes([ligneVide()]);
    setNote("");
    chargerFactures();
  }

  if (!profilId) return null;

  return (
    <div className="admin-edit-panel">
      <h4 style={{ margin: "0 0 4px" }}>Créer une facture pour {compte.profil.full_name || compte.email}</h4>
      <p className="section-hint" style={{ marginBottom: "12px" }}>
        Envoyée par courriel à {compte.email}, avec un lien pour payer en ligne.
      </p>
      {erreur && <p className="settings-msg err">{erreur}</p>}
      {resultat && (
        <p className="settings-msg ok">
          Facture {resultat.numero || ""} envoyée à {resultat.courriel}.{" "}
          {resultat.url && (
            <a href={resultat.url} target="_blank" rel="noreferrer">
              Voir la facture
            </a>
          )}
          {!resultat.taxes && " (sans taxes : elles ne sont pas encore configurées)"}
        </p>
      )}

      {lignes.map((l, i) => (
        <div className="field-row" key={i} style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 3 }}>
            {i === 0 && <label>Description</label>}
            <input type="text" value={l.description} onChange={(e) => majLigne(i, "description", e.target.value)} placeholder="Ex: Installation du module Horaire" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            {i === 0 && <label>Quantité</label>}
            <input type="number" min="1" step="1" value={l.quantite} onChange={(e) => majLigne(i, "quantite", e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            {i === 0 && <label>Prix unitaire ($)</label>}
            <input type="number" min="0" step="0.01" value={l.prix} onChange={(e) => majLigne(i, "prix", e.target.value)} placeholder="0,00" />
          </div>
          {lignes.length > 1 && (
            <button type="button" className="admin-icon-btn" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} aria-label="Retirer la ligne">
              ✕
            </button>
          )}
        </div>
      ))}
      <button type="button" className="admin-icon-btn" onClick={() => setLignes((ls) => [...ls, ligneVide()])}>
        + Ajouter une ligne
      </button>

      <div className="field-row" style={{ marginTop: "14px" }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Échéance (jours)</label>
          <input type="number" min="1" max="120" value={joursEcheance} onChange={(e) => setJoursEcheance(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 3 }}>
          <label>Note sur la facture (facultatif)</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="admin-edit-actions">
        <button className="submit-btn" onClick={envoyer} disabled={envoi || sousTotal <= 0}>
          {envoi ? "Envoi..." : `Créer et envoyer (${sousTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} avant taxes)`}
        </button>
      </div>

      {factures.length > 0 && (
        <>
          <div className="settings-divider">Factures déjà envoyées</div>
          {factures.map((f) => (
            <div className="admin-row" key={f.id}>
              <div className="admin-row-main">
                <div className="admin-row-title">
                  {f.numero || "Facture"} · {argent(f.total)}
                </div>
                <div className="admin-row-sub">
                  {new Date(f.creee * 1000).toLocaleDateString("fr-CA")} · {STATUTS[f.statut] || f.statut}
                </div>
              </div>
              {f.url && (
                <a className="admin-icon-btn" href={f.url} target="_blank" rel="noreferrer">
                  Ouvrir
                </a>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
