"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatMontant } from "@/lib/commandes";
import { imprimerCommande } from "@/lib/commandesClient";

const ARTICLE_VIDE = { nom: "", quantite: "1", prix: "" };

function BoutonsChoix({ valeur, onChange, choix }) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {choix.map(([id, label]) => (
        <button
          key={String(id)}
          type="button"
          className="admin-icon-btn"
          style={valeur === id ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Création / modification d'une commande saisie à la main (source = 'manuel').
// `commande` = la ligne à modifier, ou null pour une nouvelle commande.
export default function CommandeManuelleModal({ entrepriseId, commande, onClose, onSaved }) {
  const [clientNom, setClientNom] = useState(commande?.client_nom || "");
  const [mode, setMode] = useState(commande?.mode || "ramassage");
  const [paye, setPaye] = useState(commande ? commande.statut_paiement === "PAID" : false);
  const [articles, setArticles] = useState(
    commande?.items?.length
      ? commande.items.map((it) => ({ nom: it.nom, quantite: String(it.quantite), prix: it.prix != null ? String(it.prix) : "" }))
      : [{ ...ARTICLE_VIDE }]
  );
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState("");

  function majArticle(i, champ, valeur) {
    setArticles((prev) => prev.map((a, idx) => (idx === i ? { ...a, [champ]: valeur } : a)));
  }

  const articlesValides = articles
    .map((a) => ({
      nom: a.nom.trim(),
      quantite: parseInt(a.quantite, 10) || 0,
      prix: parseFloat(String(a.prix).replace(",", ".")),
    }))
    .filter((a) => a.nom && a.quantite > 0);

  const total = articlesValides.reduce((sum, a) => sum + a.quantite * (Number.isFinite(a.prix) ? a.prix : 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (articlesValides.length === 0) {
      setErreur("Ajoute au moins un article.");
      return;
    }
    setSaving(true);
    setErreur("");

    const champs = {
      client_nom: clientNom.trim() || null,
      mode,
      statut_paiement: paye ? "PAID" : "NOT_PAID",
      total: Math.round(total * 100) / 100,
      items: articlesValides.map((a) => ({
        nom: a.nom,
        quantite: a.quantite,
        prix: Number.isFinite(a.prix) ? a.prix : null,
        options: [],
      })),
      updated_at: new Date().toISOString(),
    };

    let error;
    let nouvelId = null;
    if (commande) {
      ({ error } = await supabase.from("commandes_en_ligne").update(champs).eq("id", commande.id));
    } else {
      const { count } = await supabase
        .from("commandes_en_ligne")
        .select("id", { count: "exact", head: true })
        .eq("entreprise_id", entrepriseId)
        .eq("source", "manuel");
      // Id généré ici (pas de insert().select()) pour pouvoir demander
      // l'impression juste après sans relire la ligne.
      nouvelId = crypto.randomUUID();
      ({ error } = await supabase.from("commandes_en_ligne").insert({
        ...champs,
        id: nouvelId,
        entreprise_id: entrepriseId,
        source: "manuel",
        source_id: crypto.randomUUID(),
        numero: `M${(count || 0) + 1}`,
        statut: "APPROVED",
        statut_preparation: "NOT_FULFILLED",
        date_commande: new Date().toISOString(),
      }));
    }

    setSaving(false);
    if (error) {
      setErreur("Impossible d'enregistrer la commande. As-tu exécuté commandes_manuelles.sql dans Supabase?");
      return;
    }
    // N'imprime que si le réglage "Impression des commandes manuelles" est
    // sur "automatique" (décidé côté serveur).
    if (nouvelId) await imprimerCommande(entrepriseId, nouvelId, "creation");
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{commande ? "Modifier la commande" : "Nouvelle commande"}</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            Fermer
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nom du client (optionnel)</label>
            <input type="text" value={clientNom} onChange={(e) => setClientNom(e.target.value)} placeholder="Ex: Marie Tremblay" />
          </div>

          <div className="field">
            <label>Ramassage ou livraison</label>
            <BoutonsChoix
              valeur={mode}
              onChange={setMode}
              choix={[
                ["ramassage", "Ramassage"],
                ["livraison", "Livraison"],
              ]}
            />
          </div>

          <div className="field">
            <label>Articles</label>
            {articles.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 56px 80px auto", gap: "6px", marginBottom: "6px" }}>
                <input type="text" value={a.nom} onChange={(e) => majArticle(i, "nom", e.target.value)} placeholder="Article" />
                <input type="number" min="1" value={a.quantite} onChange={(e) => majArticle(i, "quantite", e.target.value)} aria-label="Quantité" />
                <input
                  type="text"
                  inputMode="decimal"
                  value={a.prix}
                  onChange={(e) => majArticle(i, "prix", e.target.value)}
                  placeholder="Prix"
                  aria-label="Prix unitaire"
                />
                <button
                  type="button"
                  className="admin-icon-btn danger"
                  onClick={() => setArticles((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [{ ...ARTICLE_VIDE }]))}
                  aria-label="Retirer l'article"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="admin-icon-btn" onClick={() => setArticles((prev) => [...prev, { ...ARTICLE_VIDE }])}>
              + Ajouter un article
            </button>
          </div>

          <div className="field">
            <label>Paiement</label>
            <BoutonsChoix
              valeur={paye}
              onChange={setPaye}
              choix={[
                [true, "Payée"],
                [false, "Non payée"],
              ]}
            />
          </div>

          <p style={{ fontWeight: 700, margin: "12px 0" }}>Total : {formatMontant(total)}</p>
          {erreur && <p className="settings-msg err">{erreur}</p>}

          <div className="admin-edit-actions">
            <button type="submit" className="submit-btn" disabled={saving}>
              {saving ? "Enregistrement..." : commande ? "Enregistrer" : "Ajouter la commande"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
