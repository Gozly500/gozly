"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatMontant, bornesJour } from "@/lib/commandes";
import { imprimerCommande, mettreAJourTachesCommandes } from "@/lib/commandesClient";
import { lireProduitsTries } from "@/lib/ordreProduits";
import { IconFlecheGauche, IconFlecheDroite } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import { LangueProvider } from "@/components/moi/LangueContext";
import CatalogueCommande from "@/components/commandes/CatalogueCommande";

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
  const { t } = useT();
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
          {t(label)}
        </button>
      ))}
    </div>
  );
}

// Création / modification d'une commande saisie à la main (source = 'manuel').
// `commande` = la ligne à modifier, ou null pour une nouvelle commande.
export default function CommandeManuelleModal({ entrepriseId, commande, onClose, onSaved }) {
  const { t, lang } = useT();
  const [vue, setVue] = useState("infos"); // "infos" | "articles" (catalogue)
  const [categories, setCategories] = useState([]);
  const [rechercheCatalogue, setRechercheCatalogue] = useState("");
  const [articleLibre, setArticleLibre] = useState({ nom: "", prix: "" });
  const [clientNom, setClientNom] = useState(commande?.client_nom || "");
  const [telephone, setTelephone] = useState(commande?.client_telephone || "");
  const [note, setNote] = useState(commande?.note || "");
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
  const ramassageInitial = dateHeureQuebec(commande?.date_ramassage);
  const [dateRamassage, setDateRamassage] = useState(ramassageInitial.date);
  const [heureRamassage, setHeureRamassage] = useState(ramassageInitial.heure);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    lireProduitsTries(
      (colonnes) => supabase.from("produits_inventaire").select(colonnes).eq("entreprise_id", entrepriseId).order("nom", { ascending: true }).limit(1000),
      "id, nom, sku, prix, source, source_id, categorie_id"
    ).then(setProduits);
    supabase
      .from("categories_inventaire")
      .select("id, nom, ordre")
      .eq("entreprise_id", entrepriseId)
      .order("ordre", { ascending: true })
      .order("nom", { ascending: true })
      .then(({ data }) => setCategories(data || []));
  }, [entrepriseId]);

  // Catalogue (CatalogueCommande) : le panier, ce sont les articles de la commande (sans la ligne vide du départ).
  const panier = articles
    .map((a, i) => ({ i, nom: a.nom, quantite: parseInt(a.quantite, 10) || 0, prix: parseFloat(String(a.prix).replace(",", ".")), vide: !a.nom.trim() }))
    .filter((l) => !l.vide && l.quantite > 0);

  function ajouterAuPanier(produit, quantite) {
    setArticles((prev) => {
      const gardes = prev.filter((a) => a.nom.trim());
      const idx = produit.id ? gardes.findIndex((a) => a.produit?.id === produit.id) : -1;
      if (idx >= 0) return gardes.map((a, k) => (k === idx ? { ...a, quantite: String((parseInt(a.quantite, 10) || 0) + quantite) } : a));
      const ligne = produit.libre
        ? { ...ARTICLE_VIDE, nom: produit.nom, quantite: String(quantite), prix: Number.isFinite(produit.prix) ? String(produit.prix) : "" }
        : {
            ...ARTICLE_VIDE,
            nom: produit.nom,
            quantite: String(quantite),
            prix: produit.prix != null ? String(produit.prix) : "",
            produit,
            produitId: produitIdWix(produit),
            sku: produit.sku || null,
            options: separerVariante(produit.nom).options,
          };
      return [...gardes, ligne];
    });
  }

  function changerQuantitePanier(i, delta) {
    setArticles((prev) => prev.map((a, k) => (k === i ? { ...a, quantite: String(Math.max(1, (parseInt(a.quantite, 10) || 1) + delta)) } : a)));
  }

  function retirerDuPanier(i) {
    setArticles((prev) => {
      const reste = prev.filter((_, k) => k !== i);
      return reste.length > 0 ? reste : [{ ...ARTICLE_VIDE }];
    });
  }

  // « Valider » : retire les lignes vides et revient à la commande.
  function validerArticles() {
    setArticles((prev) => {
      const gardes = prev.filter((a) => a.nom.trim() && (parseInt(a.quantite, 10) || 0) > 0);
      return gardes.length > 0 ? gardes : [{ ...ARTICLE_VIDE }];
    });
    setVue("infos");
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
      setErreur(t("Ajoute au moins un article."));
      return;
    }
    setSaving(true);
    setErreur("");

    const champs = {
      client_nom: clientNom.trim() || null,
      // Seulement s'il est saisi (colonne ajoutée par commandes_telephone.sql).
      ...(telephone.trim() ? { client_telephone: telephone.trim() } : commande?.client_telephone ? { client_telephone: null } : {}),
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
        // Saisie par un employé : déjà prise en charge.
        etape: "traitee",
        date_commande: new Date().toISOString(),
      }));
    }

    setSaving(false);
    if (error) {
      setErreur(t("Impossible d'enregistrer la commande. As-tu exécuté commandes_manuelles.sql dans Supabase?"));
      return;
    }
    // Info supplémentaire : écrite à part (la commande s'enregistre même si commandes_note.sql n'est pas exécuté).
    if (note.trim() || commande?.note) {
      await supabase
        .from("commandes_en_ligne")
        .update({ note: note.trim() || null })
        .eq("id", commande ? commande.id : nouvelId);
    }
    // N'imprime que si le réglage "Impression des commandes manuelles" est
    // sur "automatique" (décidé côté serveur).
    if (nouvelId) await imprimerCommande(entrepriseId, nouvelId, "creation");
    await mettreAJourTachesCommandes(entrepriseId);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={vue === "articles" ? { maxWidth: "880px", width: "100%" } : undefined} onClick={(e) => e.stopPropagation()}>
        {vue === "articles" ? (
          <>
            <div className="modal-head">
              <h3>{t("Ajouter des produits")}</h3>
              <button type="button" className="admin-icon-btn" onClick={validerArticles}>
                <IconFlecheGauche className="gozly-icon" /> {t("Retour")}
              </button>
            </div>
            <LangueProvider forcee={lang}>
              <CatalogueCommande
                produits={produits}
                categories={categories}
                panier={panier}
                onAjouter={ajouterAuPanier}
                onQuantite={changerQuantitePanier}
                onRetirer={retirerDuPanier}
                onValider={validerArticles}
                recherche={rechercheCatalogue}
                setRecherche={setRechercheCatalogue}
                libre={articleLibre}
                setLibre={setArticleLibre}
              />
            </LangueProvider>
          </>
        ) : (
          <>
        <div className="modal-head">
          <h3>{commande ? t("Modifier la commande") : t("Nouvelle commande")}</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            {t("Fermer")}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{t("Nom du client (optionnel)")}</label>
            <input type="text" value={clientNom} onChange={(e) => setClientNom(e.target.value)} placeholder={t("Ex: Marie Tremblay")} />
          </div>

          <div className="field">
            <label>{t("Téléphone (optionnel)")}</label>
            <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder={t("Ex: 514 555-0123")} maxLength={40} />
          </div>

          <div className="field">
            <label>{t("Info supplémentaire (optionnel)")}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("Ex: sans noix, allergie, message sur le gâteau")}
              maxLength={500}
              rows={2}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </div>

          <div className="field">
            <label>{t("Ramassage ou livraison")}</label>
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
            <label>{t("Date et heure de ramassage (optionnel, pour une précommande)")}</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "8px" }}>
              <input type="date" value={dateRamassage} onChange={(e) => setDateRamassage(e.target.value)} />
              <input type="time" value={heureRamassage} onChange={(e) => setHeureRamassage(e.target.value)} disabled={!dateRamassage} />
            </div>
          </div>

          <div className="field">
            <label>{t("Articles")}</label>
            <button type="button" className="submit-btn" style={{ width: "100%" }} onClick={() => setVue("articles")}>
              {panier.length > 0 ? <>{panier.reduce((n, l) => n + l.quantite, 0)} {t("article(s)")} · {formatMontant(total)}</> : t("Ajouter des produits")}{" "}
              <IconFlecheDroite className="gozly-icon-inline" />
            </button>
          </div>

          <div className="field">
            <label>{t("Paiement")}</label>
            <BoutonsChoix
              valeur={paye}
              onChange={setPaye}
              choix={[
                [true, "Payée"],
                [false, "Non payée"],
              ]}
            />
          </div>

          <p style={{ fontWeight: 700, margin: "12px 0" }}>{t("Total :")}{" "}{formatMontant(total)}</p>
          {erreur && <p className="settings-msg err">{erreur}</p>}

          <div className="admin-edit-actions">
            <button type="submit" className="submit-btn" disabled={saving}>
              {saving ? t("Enregistrement...") : commande ? t("Enregistrer") : t("Ajouter la commande")}
            </button>
          </div>
        </form>
          </>
        )}
      </div>
    </div>
  );
}
