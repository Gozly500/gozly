"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatMontant, bornesJour } from "@/lib/commandes";
import { imprimerCommande, mettreAJourTachesCommandes } from "@/lib/commandesClient";

const ARTICLE_VIDE = { nom: "", quantite: "1", prix: "", produit: null, produitId: null, sku: null, options: [] };

// Un produit de l'inventaire Wix en variante s'appelle "Produit — Variante" : on
// sépare le nom du produit et la variante pour que la commande manuelle ait la
// même forme qu'une commande Wix (nom + option).
function separerVariante(nomComplet) {
  const [base, ...reste] = String(nomComplet).split(" — ");
  return reste.length > 0 ? { nom: base.trim(), options: [reste.join(" — ").trim()] } : { nom: base.trim(), options: [] };
}

// Id du produit chez Wix (catalogue V1: "v1:<produit>:<variante>"), pour retrouver l'article.
function produitIdWix(produit) {
  if (produit.source === "wix" && produit.source_id?.startsWith("v1:")) return produit.source_id.split(":")[1];
  return null;
}

// Date (YYYY-MM-DD) et heure (HH:MM) du Québec d'un instant ISO, pour préremplir le formulaire.
function dateHeureQuebec(iso) {
  if (!iso) return { date: "", heure: "" };
  const d = new Date(iso);
  return {
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(d),
    heure: new Intl.DateTimeFormat("en-GB", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hour12: false }).format(d),
  };
}

// Date + heure saisies (heure du Québec) -> instant ISO UTC.
function versIsoQuebec(date, heure) {
  const [h, m] = (heure || "12:00").split(":").map(Number);
  return new Date(new Date(bornesJour(date).debut).getTime() + ((h || 0) * 60 + (m || 0)) * 60000).toISOString();
}

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
      ? commande.items.map((it) => ({
          nom: it.options?.length ? `${it.nom} — ${it.options.join(", ")}` : it.nom,
          quantite: String(it.quantite),
          prix: it.prix != null ? String(it.prix) : "",
          produit: null,
          produitId: it.produit_id || null,
          sku: it.sku || null,
          options: it.options || [],
        }))
      : [{ ...ARTICLE_VIDE }]
  );
  const [produits, setProduits] = useState([]);
  const [ouvert, setOuvert] = useState(null); // index de la ligne dont la liste de produits est ouverte
  const ramassageInitial = dateHeureQuebec(commande?.date_ramassage);
  const [dateRamassage, setDateRamassage] = useState(ramassageInitial.date);
  const [heureRamassage, setHeureRamassage] = useState(ramassageInitial.heure);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    supabase
      .from("produits_inventaire")
      .select("id, nom, sku, prix, source, source_id")
      .eq("entreprise_id", entrepriseId)
      .order("nom", { ascending: true })
      .limit(1000)
      .then(({ data }) => setProduits(data || []));
  }, [entrepriseId]);

  function majArticle(i, champ, valeur) {
    setArticles((prev) => prev.map((a, idx) => (idx === i ? { ...a, [champ]: valeur } : a)));
  }

  // Taper dans le champ efface le lien avec le produit choisi (article libre) ;
  // choisir un produit de la liste remplit son nom, son prix et ses références.
  function taperNom(i, texte) {
    setArticles((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, nom: texte, produit: null, produitId: null, sku: null, options: [] } : a))
    );
    setOuvert(i);
  }

  function choisirProduit(i, produit) {
    setArticles((prev) =>
      prev.map((a, idx) =>
        idx === i
          ? {
              ...a,
              nom: produit.nom,
              prix: produit.prix != null ? String(produit.prix) : a.prix,
              produit,
              produitId: produitIdWix(produit),
              sku: produit.sku || null,
              options: separerVariante(produit.nom).options,
            }
          : a
      )
    );
    setOuvert(null);
  }

  const articlesValides = articles
    .map((a) => {
      // Un article venu de l'inventaire est séparé en nom + variante ; un
      // article libre ou déjà enregistré garde ses options telles quelles.
      const separe = a.produit
        ? separerVariante(a.nom)
        : { nom: a.options?.length ? a.nom.split(" — ")[0].trim() : a.nom.trim(), options: a.options || [] };
      return {
        nom: separe.nom,
        options: separe.options,
        produit_id: a.produitId || null,
        sku: a.sku || null,
        quantite: parseInt(a.quantite, 10) || 0,
        prix: parseFloat(String(a.prix).replace(",", ".")),
      };
    })
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
      // Précommande : la date/heure où le client vient chercher sa commande.
      date_ramassage: dateRamassage ? versIsoQuebec(dateRamassage, heureRamassage) : null,
      date_ramassage_fin: null,
      statut_paiement: paye ? "PAID" : "NOT_PAID",
      total: Math.round(total * 100) / 100,
      items: articlesValides.map((a) => ({
        nom: a.nom,
        quantite: a.quantite,
        prix: Number.isFinite(a.prix) ? a.prix : null,
        produit_id: a.produit_id,
        sku: a.sku,
        options: a.options,
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
        canal: "MANUEL",
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
    await mettreAJourTachesCommandes(entrepriseId);
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
            <label>Date et heure de ramassage (optionnel, pour une précommande)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "8px" }}>
              <input type="date" value={dateRamassage} onChange={(e) => setDateRamassage(e.target.value)} />
              <input type="time" value={heureRamassage} onChange={(e) => setHeureRamassage(e.target.value)} disabled={!dateRamassage} />
            </div>
          </div>

          <div className="field">
            <label>Articles</label>
            {articles.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 56px 80px auto", gap: "6px", marginBottom: "6px" }}>
                <div className="emplacement-select-wrap" style={{ minWidth: 0 }}>
                  <input
                    type="text"
                    value={a.nom}
                    onChange={(e) => taperNom(i, e.target.value)}
                    onFocus={() => setOuvert(i)}
                    onBlur={() => setTimeout(() => setOuvert((o) => (o === i ? null : o)), 150)}
                    placeholder="Cherche un produit de l'inventaire"
                    autoComplete="off"
                  />
                  {ouvert === i && (
                    <div className="emplacement-select-options" style={{ maxHeight: "220px", overflowY: "auto" }}>
                      {produits
                        .filter((p) => !a.nom.trim() || a.produit?.id === p.id || p.nom.toLowerCase().includes(a.nom.trim().toLowerCase()))
                        .slice(0, 40)
                        .map((p) => (
                          <div
                            key={p.id}
                            className={`emplacement-select-option${a.produit?.id === p.id ? " active" : ""}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              choisirProduit(i, p);
                            }}
                          >
                            {p.nom}
                            {p.prix != null && <span style={{ color: "var(--text-dim)" }}> · {formatMontant(p.prix)}</span>}
                          </div>
                        ))}
                      {produits.length === 0 && (
                        <div className="emplacement-select-option" style={{ color: "var(--text-dim)", cursor: "default" }}>
                          Aucun produit dans l'inventaire : l'article sera libre.
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
