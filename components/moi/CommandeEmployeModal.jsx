"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";
import { formatMontant } from "@/lib/commandes";
import { formaterTelephone } from "@/lib/telephone";
import { separerVariante, produitIdWix, versIsoQuebec, dateHeureQuebec } from "@/lib/commandesManuelles";
import { IconFlecheDroite, IconFlecheGauche, IconX } from "@/components/icons/Pictogrammes";
import { SaisieGozly, ChampGozly } from "@/components/saisie/SaisieGozly";
import CatalogueCommande from "@/components/commandes/CatalogueCommande";

const ARTICLE_VIDE = { nom: "", quantite: "1", prix: "", produit: null, produitId: null, sku: null, options: [] };

// Prise de commande depuis le téléphone, en deux écrans :
// 1. les infos de la commande (nom, téléphone, date et heure, ramassage ou
//    livraison, payée ou non) avec un bouton qui mène aux produits ;
// 2. les produits seulement (produit, quantité, prix), avec "Ajouter" et
//    "Enregistrer" - qui ramène au 1er écran, où le bouton affiche alors le
//    nombre d'articles.
//
// Par défaut il parle aux routes de l'app employé ; l'app gestionnaire lui passe ses
// propres fonctions : chargerProduits() -> liste de produits, enregistrer(commande) -> { ok, error }.
// saisieGozly (tablette du kiosque) : clavier, calendrier et choix d'heure de Gozly à la place de ceux du système.
// catalogue : écran « Ajouter des produits » (catégories, produits, panier) au lieu de la liste de lignes ; par défaut, comme saisieGozly.
// chargerCategories (optionnel) : catégories pour ce catalogue.
export default function CommandeEmployeModal({ dateParDefaut, onClose, onSaved, chargerProduits, chargerCategories, enregistrer, saisieGozly = false, catalogue = saisieGozly, commande = null }) {
  const { t } = useLangue();
  // commande : la commande à modifier (null = nouvelle commande).
  const ramassageInitial = dateHeureQuebec(commande?.date_ramassage);
  const finInitiale = dateHeureQuebec(commande?.date_ramassage_fin);
  const [vue, setVue] = useState("infos"); // "infos" | "articles"
  const [clientNom, setClientNom] = useState(commande?.client_nom || "");
  const [telephone, setTelephone] = useState(commande?.client_telephone || "");
  const [note, setNote] = useState(commande?.note || "");
  const [mode, setMode] = useState(commande?.mode || "ramassage");
  const [paye, setPaye] = useState(commande ? commande.statut_paiement === "PAID" : false);
  const [methode, setMethode] = useState(commande?.methode_paiement || "");
  const [dateRamassage, setDateRamassage] = useState(commande ? ramassageInitial.date : dateParDefaut);
  const [heureRamassage, setHeureRamassage] = useState(ramassageInitial.heure || "12:00");
  const [plage, setPlage] = useState(!!commande?.date_ramassage_fin); // le client passera « entre telle heure et telle heure »
  const [heureFin, setHeureFin] = useState(finInitiale.heure || "13:00");
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
  const [categories, setCategories] = useState([]);
  const [rechercheCatalogue, setRechercheCatalogue] = useState("");
  const [articleLibre, setArticleLibre] = useState({ nom: "", prix: "" });
  const [ouvert, setOuvert] = useState(null); // ligne dont la liste de produits est ouverte
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const source = chargerProduits
      ? chargerProduits()
      : employeFetch("/api/employe-app/commandes/produits")
          .then((res) => res.json())
          .then((data) => data.produits || []);
    Promise.resolve(source)
      .then((liste) => setProduits(liste || []))
      .catch(() => {});
    if (catalogue && chargerCategories) {
      Promise.resolve(chargerCategories())
        .then((liste) => setCategories(liste || []))
        .catch(() => {});
    }
  }, []);

  // Catalogue de la tablette : le panier, ce sont les articles de la commande (sans la ligne vide du départ).
  const panier = articles
    .map((a, i) => ({ i, nom: a.nom, quantite: parseInt(a.quantite, 10) || 0, prix: parseFloat(String(a.prix).replace(",", ".")), vide: !a.nom.trim() }))
    .filter((l) => !l.vide && l.quantite > 0);

  function ajouterAuPanier(produit, quantite) {
    setArticles((prev) => {
      const gardes = prev.filter((a) => a.nom.trim());
      const idx = produit.id ? gardes.findIndex((a) => a.produit?.id === produit.id) : -1;
      if (idx >= 0) {
        return gardes.map((a, k) => (k === idx ? { ...a, quantite: String((parseInt(a.quantite, 10) || 0) + quantite) } : a));
      }
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

  function majArticle(i, champ, valeur) {
    setArticles((prev) => prev.map((a, idx) => (idx === i ? { ...a, [champ]: valeur } : a)));
  }

  // Taper un nom = article libre ; choisir dans la liste = nom, prix et références du produit.
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

  const nombreArticles = articlesValides.reduce((somme, a) => somme + a.quantite, 0);
  const total = articlesValides.reduce((somme, a) => somme + a.quantite * (Number.isFinite(a.prix) ? a.prix : 0), 0);

  // "Enregistrer" sur l'écran des produits : retire les lignes vides et revient aux infos.
  function enregistrerArticles() {
    setArticles((prev) => {
      const gardes = prev.filter((a) => a.nom.trim() && (parseInt(a.quantite, 10) || 0) > 0);
      return gardes.length > 0 ? gardes : [{ ...ARTICLE_VIDE }];
    });
    setOuvert(null);
    setVue("infos");
  }

  async function creerCommande() {
    if (articlesValides.length === 0) {
      setErreur(t("commandes.erreurArticle"));
      return;
    }
    const avecPlage = plage && dateRamassage;
    if (avecPlage && heureFin <= heureRamassage) {
      setErreur(t("sg.erreurPlage"));
      return;
    }
    setBusy(true);
    setErreur("");

    const commande = {
      client_nom: clientNom,
      client_telephone: telephone,
      note,
      mode,
      paye,
      methode_paiement: paye ? methode || null : null,
      date_ramassage: dateRamassage ? versIsoQuebec(dateRamassage, heureRamassage) : null,
      date_ramassage_fin: avecPlage ? versIsoQuebec(dateRamassage, heureFin) : null,
      items: articlesValides.map((a) => ({ ...a, prix: Number.isFinite(a.prix) ? a.prix : null })),
    };

    try {
      let resultat;
      if (enregistrer) {
        resultat = await enregistrer(commande);
      } else {
        const res = await employeFetch("/api/employe-app/commandes", { method: "POST", body: JSON.stringify(commande) });
        const data = await res.json().catch(() => ({}));
        resultat = { ok: res.ok, error: data.error };
      }
      if (!resultat.ok) {
        setErreur(resultat.error || t("commandes.erreurEnregistrement"));
        setBusy(false);
        return;
      }
      onSaved();
    } catch {
      setErreur(t("commandes.erreurEnregistrement"));
      setBusy(false);
    }
  }

  const boutonChoix = (actif) => (actif ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <SaisieGozly actif={saisieGozly}>
      <div className={`modal-card${catalogue && vue === "articles" ? " cg-large" : ""}`} style={{ maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        {vue === "articles" && catalogue ? (
          <>
            <div className="modal-head">
              <h3>{t("commandes.ajouterProduits")}</h3>
              <button type="button" className="admin-icon-btn" onClick={enregistrerArticles}>
                <IconFlecheGauche className="gozly-icon" /> {t("commandes.retour")}
              </button>
            </div>
            <CatalogueCommande
              produits={produits}
              categories={categories}
              panier={panier}
              onAjouter={ajouterAuPanier}
              onQuantite={changerQuantitePanier}
              onRetirer={retirerDuPanier}
              onValider={enregistrerArticles}
              recherche={rechercheCatalogue}
              setRecherche={setRechercheCatalogue}
              libre={articleLibre}
              setLibre={setArticleLibre}
            />
          </>
        ) : vue === "infos" ? (
          <>
            <div className="modal-head">
              <h3>{commande ? t("commandes.modifierCommande") : t("commandes.nouvelle")}</h3>
              <button type="button" className="admin-icon-btn" onClick={onClose}>
                {t("nav.fermer")}
              </button>
            </div>

            <div className="field">
              <ChampGozly id="nom" type="texte" label={t("commandes.nomCommande")} value={clientNom} onChange={setClientNom} placeholder={t("commandes.nomCommande")} maxLength={120} />
            </div>

            <div className="field">
              <ChampGozly id="tel" type="tel" label={t("commandes.telephone")} value={telephone} onChange={(v) => setTelephone(formaterTelephone(v))} placeholder={t("commandes.telephone")} maxLength={40} />
            </div>

            <div className="field">
              <ChampGozly
                id="note"
                type="textarea"
                label={t("commandes.note")}
                value={note}
                onChange={setNote}
                placeholder={t("commandes.note")}
                maxLength={500}
                rows={2}
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            <div className="field">
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 110px", gap: "6px" }}>
                <ChampGozly id="date" type="date" label={t("commandes.date")} placeholder={t("commandes.date")} value={dateRamassage} onChange={setDateRamassage} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", margin: 0 }} />
                <ChampGozly id="heure" type="heure" label={t("commandes.heure")} placeholder={t("commandes.heure")} value={heureRamassage} onChange={setHeureRamassage} disabled={!dateRamassage} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", margin: 0 }} />
              </div>
              {/* Certains clients ne sont pas sûrs : « je passe entre telle heure et telle heure ». */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
                <button
                  type="button"
                  className="admin-icon-btn"
                  aria-pressed={plage}
                  style={{ flex: "0 0 auto", ...boutonChoix(plage) }}
                  disabled={!dateRamassage}
                  onClick={() => {
                    if (!plage) {
                      const [h, m] = heureRamassage.split(":").map(Number);
                      if (heureFin <= heureRamassage) setHeureFin(`${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`);
                    }
                    setPlage((p) => !p);
                  }}
                >
                  {plage ? "✓ " : ""}{t("sg.plage")}
                </button>
                {plage && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ChampGozly id="heureFin" type="heure" label={t("sg.jusqua")} placeholder={t("sg.jusqua")} value={heureFin} onChange={setHeureFin} style={{ width: "100%", minWidth: 0, boxSizing: "border-box", margin: 0 }} />
                  </div>
                )}
              </div>
            </div>

            <div className="field">
              <button type="button" className="submit-btn" style={{ width: "100%" }} onClick={() => setVue("articles")}>
                {nombreArticles > 0
                  ? <>{t("commandes.nArticles", { n: nombreArticles })} · {formatMontant(total)} <IconFlecheDroite className="gozly-icon-inline" /></>
                  : <>{t("commandes.ajouterProduits")} <IconFlecheDroite className="gozly-icon-inline" /></>}
              </button>
            </div>

            <div className="field">
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="admin-icon-btn" style={{ flex: 1, ...boutonChoix(mode === "ramassage") }} onClick={() => setMode("ramassage")}>
                  {t("commandes.ramassage")}
                </button>
                <button type="button" className="admin-icon-btn" style={{ flex: 1, ...boutonChoix(mode === "livraison") }} onClick={() => setMode("livraison")}>
                  {t("commandes.livraison")}
                </button>
              </div>
            </div>

            <div className="field">
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="admin-icon-btn" style={{ flex: 1, ...boutonChoix(paye) }} onClick={() => setPaye(true)}>
                  {t("commandes.payee")}
                </button>
                <button type="button" className="admin-icon-btn" style={{ flex: 1, ...boutonChoix(!paye) }} onClick={() => setPaye(false)}>
                  {t("commandes.nonPayee")}
                </button>
              </div>
              {paye && (
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  {[
                    ["Comptant", "commandes.methode.comptant"],
                    ["Carte", "commandes.methode.carte"],
                    ["Autre", "commandes.methode.autre"],
                  ].map(([id, cle]) => (
                    <button
                      key={id}
                      type="button"
                      className="admin-icon-btn"
                      style={{ flex: 1, ...boutonChoix(methode === id) }}
                      onClick={() => setMethode(methode === id ? "" : id)}
                    >
                      {t(cle)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {erreur && <p className="settings-msg err">{erreur}</p>}

            <button type="button" className="submit-btn" style={{ width: "100%", marginTop: "6px" }} disabled={busy || nombreArticles === 0} onClick={creerCommande}>
              {busy ? t("commandes.enregistrement") : commande ? t("commandes.enregistrer") : t("commandes.ajouterCommande")}
            </button>
          </>
        ) : (
          <>
            <div className="modal-head">
              <h3>{t("commandes.articles")}</h3>
              <button type="button" className="admin-icon-btn" onClick={enregistrerArticles}>
                <IconFlecheGauche className="gozly-icon" /> {t("commandes.retour")}
              </button>
            </div>

            {articles.map((a, i) => (
              <div key={i} style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                  <div className="emplacement-select-wrap" style={{ minWidth: 0, flex: 1, width: "auto", marginBottom: 0 }}>
                    <ChampGozly
                      id={`nom${i}`}
                      type="texte"
                      label={t("commandes.produit")}
                      value={a.nom}
                      onChange={(v) => taperNom(i, v)}
                      onOuvre={() => setOuvert(i)}
                      onBlur={() => setTimeout(() => setOuvert((o) => (o === i ? null : o)), 300)}
                      placeholder={t("commandes.produit")}
                      style={{ width: "100%", boxSizing: "border-box", margin: 0 }}
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
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => choisirProduit(i, p)}
                            >
                              {p.nom}
                              {p.prix != null && <span style={{ color: "var(--text-dim)" }}> · {formatMontant(p.prix)}</span>}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="admin-icon-btn danger"
                    onClick={() => setArticles((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [{ ...ARTICLE_VIDE }]))}
                    aria-label={t("commandes.retirerArticle")}
                    style={{ width: "40px", height: "40px", boxSizing: "border-box", flexShrink: 0, padding: 0, margin: 0, borderRadius: "12px", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <IconX className="gozly-icon" />
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "6px", marginTop: "6px" }}>
                  <ChampGozly
                    id={`qte${i}`}
                    type="entier"
                    label={t("commandes.quantite")}
                    value={a.quantite}
                    onChange={(v) => majArticle(i, "quantite", v)}
                    onOuvre={() => setOuvert(null)}
                    placeholder={t("commandes.quantite")}
                    style={{ width: "100%", minWidth: 0, boxSizing: "border-box", margin: 0 }}
                  />
                  <ChampGozly
                    id={`prix${i}`}
                    type="decimal"
                    label={t("commandes.prix")}
                    value={a.prix}
                    onChange={(v) => majArticle(i, "prix", v)}
                    onOuvre={() => setOuvert(null)}
                    placeholder={t("commandes.prix")}
                    style={{ width: "100%", minWidth: 0, boxSizing: "border-box", margin: 0 }}
                  />
                </div>
              </div>
            ))}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "18px" }}>
              <button type="button" className="admin-icon-btn" style={{ padding: "14px" }} onClick={() => setArticles((prev) => [...prev, { ...ARTICLE_VIDE }])}>
                + {t("commandes.ajouter")}
              </button>
              <button type="button" className="submit-btn" style={{ padding: "14px" }} onClick={enregistrerArticles}>
                {t("commandes.enregistrer")}
              </button>
            </div>
          </>
        )}
      </div>
      </SaisieGozly>
    </div>
  );
}
