"use client";

import { useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";
import { formatMontant } from "@/lib/commandes";
import { separerVariante } from "@/lib/commandesManuelles";
import { IconFlecheGauche, IconX } from "@/components/icons/Pictogrammes";
import { ChampGozly } from "@/components/saisie/SaisieGozly";

const SANS_CATEGORIE = "__sans";

// Sans accents ni majuscules, pour chercher « cafe » et trouver « Café ».
function normaliser(x) {
  return String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Écran « Ajouter des produits » de la tablette (dans la fenêtre de prise de commande, avec le clavier Gozly) :
// à gauche les catégories, puis les produits de la catégorie choisie (ou le résultat de la recherche) ; toucher un produit
// déplie sa carte avec − / quantité / + et « Ajouter » ; à droite le panier. « Valider » en bas du panier ramène à la commande.
// panier : [{ i, nom, quantite, prix }] (i = position de la ligne dans les articles de la commande).
// recherche / libre : état gardé par la fenêtre parente (le clavier Gozly relit la valeur du champ à chaque rendu de la fenêtre).
export default function CatalogueCommande({ produits, categories, panier, onAjouter, onQuantite, onRetirer, onValider, recherche, setRecherche, libre, setLibre }) {
  const { t } = useLangue();
  const [catId, setCatId] = useState(null); // null = liste des catégories
  const [ouvertId, setOuvertId] = useState(null); // produit dont la carte est dépliée
  const [qte, setQte] = useState(1);
  const [varianteId, setVarianteId] = useState(null); // variante choisie dans la carte dépliée

  const aSansCategorie = produits.some((p) => !p.categorie_id);
  const liste = [
    ...categories.map((c) => ({ id: c.id, nom: c.nom, n: produits.filter((p) => p.categorie_id === c.id).length })),
    ...(categories.length > 0 && aSansCategorie
      ? [{ id: SANS_CATEGORIE, nom: t("commandes.sansCategorie"), n: produits.filter((p) => !p.categorie_id).length }]
      : []),
  ].filter((c) => c.n > 0);

  const terme = normaliser(recherche);
  // Sans aucune catégorie (ou en recherche), on montre directement les produits.
  const montrerProduits = terme !== "" || catId !== null || liste.length === 0;
  const duProduit = (p) => (catId === SANS_CATEGORIE ? !p.categorie_id : catId ? p.categorie_id === catId : true);
  const produitsAffiches = produits.filter((p) => (terme ? normaliser(p.nom).includes(terme) : duProduit(p)));
  // Les variantes d’un produit (« Produit — Variante » dans l’inventaire) sont regroupées sous une seule carte.
  const groupes = [];
  const parNom = new Map();
  for (const p of produitsAffiches) {
    const base = separerVariante(p.nom).nom;
    const cle = normaliser(base);
    let g = parNom.get(cle);
    if (!g) {
      g = { id: p.id, base, items: [] };
      parNom.set(cle, g);
      groupes.push(g);
    }
    g.items.push(p);
  }
  const libelleVariante = (p) => separerVariante(p.nom).options.join(", ") || t("commandes.standard");
  const titre = terme ? t("commandes.resultats") : catId ? liste.find((c) => c.id === catId)?.nom || "" : t("commandes.categories");

  const total = panier.reduce((somme, l) => somme + l.quantite * (Number.isFinite(l.prix) ? l.prix : 0), 0);

  function basculer(id, uniqueId = null) {
    setOuvertId((o) => (o === id ? null : id));
    setVarianteId(uniqueId);
    setQte(1);
  }

  function ajouter(produit) {
    onAjouter(produit, qte);
    setOuvertId(null);
    setVarianteId(null);
    setQte(1);
  }

  function ajouterLibre() {
    const nom = libre.nom.trim();
    if (!nom) return;
    onAjouter({ id: null, nom, prix: parseFloat(String(libre.prix).replace(",", ".")), libre: true }, qte);
    setLibre({ nom: "", prix: "" });
    setOuvertId(null);
    setQte(1);
  }

  const stepper = (
    <div className="cg-stepper">
      <button type="button" className="cg-pm" onClick={() => setQte((q) => Math.max(1, q - 1))} aria-label="−">
        −
      </button>
      <span className="cg-qte">{qte}</span>
      <button type="button" className="cg-pm" onClick={() => setQte((q) => Math.min(99, q + 1))} aria-label="+">
        +
      </button>
    </div>
  );

  return (
    <div className="cg-corps">
      <div className="cg-gauche">
        <div className="cg-barre">
          {montrerProduits && liste.length > 0 && (
            <button
              type="button"
              className="admin-icon-btn"
              onClick={() => {
                setCatId(null);
                setRecherche("");
                setOuvertId(null);
              }}
            >
              <IconFlecheGauche className="gozly-icon" /> {t("commandes.categories")}
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ChampGozly
              id="cat-recherche"
              type="texte"
              label={t("commandes.rechercherProduit")}
              placeholder={t("commandes.rechercherProduit")}
              value={recherche}
              onChange={(v) => {
                setRecherche(v);
                setOuvertId(null);
              }}
              style={{ width: "100%", boxSizing: "border-box", margin: 0 }}
            />
          </div>
        </div>

        <h4 className="cg-titre">{titre}</h4>

        <div className="cg-liste">
          {!montrerProduits ? (
            liste.map((c) => (
              <button key={c.id} type="button" className="cg-cat" onClick={() => setCatId(c.id)}>
                <span>{c.nom}</span>
                <span className="cg-cat-n">{c.n}</span>
              </button>
            ))
          ) : (
            <>
              {groupes.length === 0 && <p className="cg-vide">{t("commandes.aucunProduit")}</p>}
              {groupes.map((g) => {
                const avecVariantes = g.items.length > 1 || separerVariante(g.items[0].nom).options.length > 0;
                const choisi = g.items.find((x) => x.id === varianteId) || (avecVariantes ? null : g.items[0]);
                const prix = g.items.map((x) => x.prix).filter((x) => x != null);
                const memePrix = prix.length > 0 && Math.min(...prix) === Math.max(...prix);
                const affiche = choisi?.prix != null ? formatMontant(choisi.prix) : prix.length === 0 ? null : memePrix ? formatMontant(prix[0]) : t("commandes.apartirDe", { prix: formatMontant(Math.min(...prix)) });
                return (
                  <div key={g.id} className={`cg-produit${ouvertId === g.id ? " ouvert" : ""}`}>
                    <button type="button" className="cg-produit-tete" onClick={() => basculer(g.id, g.items.length === 1 ? g.items[0].id : null)}>
                      <span className="cg-produit-nom">{g.base}</span>
                      {affiche && <span className="cg-prix">{affiche}</span>}
                    </button>
                    <div className="cg-plie">
                      <div className="cg-plie-interne">
                        {avecVariantes && (
                          <div className="cg-variantes">
                            {g.items.map((v) => (
                              <button key={v.id} type="button" className={`cg-variante${choisi?.id === v.id ? " choisie" : ""}`} onClick={() => setVarianteId(v.id)}>
                                {libelleVariante(v)}
                                {!memePrix && v.prix != null && <span className="cg-variante-prix">{formatMontant(v.prix)}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="cg-actions">
                          {stepper}
                          <button type="button" className="submit-btn" disabled={!choisi} onClick={() => ajouter(choisi)}>
                            {t("commandes.ajouter")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className={`cg-produit libre${ouvertId === "__libre" ? " ouvert" : ""}`}>
                <button type="button" className="cg-produit-tete" onClick={() => basculer("__libre")}>
                  <span className="cg-produit-nom">+ {t("commandes.articleLibre")}</span>
                </button>
                <div className="cg-plie">
                  <div className="cg-plie-interne">
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 110px", gap: "6px", marginBottom: "10px" }}>
                      <ChampGozly id="cat-libre-nom" type="texte" label={t("commandes.produit")} placeholder={t("commandes.produit")} value={libre.nom} onChange={(v) => setLibre((l) => ({ ...l, nom: v }))} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", margin: 0 }} />
                      <ChampGozly id="cat-libre-prix" type="decimal" label={t("commandes.prix")} placeholder={t("commandes.prix")} value={libre.prix} onChange={(v) => setLibre((l) => ({ ...l, prix: v }))} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", margin: 0 }} />
                    </div>
                    <div className="cg-actions">
                      {stepper}
                      <button type="button" className="submit-btn" disabled={!libre.nom.trim()} onClick={ajouterLibre}>
                        {t("commandes.ajouter")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <aside className="cg-panier">
        <h4 className="cg-titre">{t("commandes.panier")}</h4>
        <div className="cg-panier-liste">
          {panier.length === 0 ? (
            <p className="cg-vide">{t("commandes.panierVide")}</p>
          ) : (
            panier.map((l) => (
              <div key={l.i} className="cg-ligne">
                <div className="cg-ligne-haut">
                  <span className="cg-ligne-nom">{l.nom}</span>
                  <button type="button" className="cg-x" onClick={() => onRetirer(l.i)} aria-label={t("commandes.retirerArticle")}>
                    <IconX className="gozly-icon" />
                  </button>
                </div>
                <div className="cg-ligne-bas">
                  <div className="cg-stepper petit">
                    <button type="button" className="cg-pm" onClick={() => onQuantite(l.i, -1)} aria-label="−">
                      −
                    </button>
                    <span className="cg-qte">{l.quantite}</span>
                    <button type="button" className="cg-pm" onClick={() => onQuantite(l.i, 1)} aria-label="+">
                      +
                    </button>
                  </div>
                  <span className="cg-prix">{Number.isFinite(l.prix) ? formatMontant(l.quantite * l.prix) : "—"}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="cg-panier-pied">
          <div className="cg-total">
            <span>{t("commandes.total")}</span>
            <strong>{formatMontant(total)}</strong>
          </div>
          <button type="button" className="submit-btn" style={{ width: "100%" }} disabled={panier.length === 0} onClick={onValider}>
            {t("commandes.valider")}
          </button>
        </div>
      </aside>
    </div>
  );
}
