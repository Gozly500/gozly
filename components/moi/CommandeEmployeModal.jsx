"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";
import { formatMontant } from "@/lib/commandes";
import { separerVariante, produitIdWix, versIsoQuebec } from "@/lib/commandesManuelles";

const ARTICLE_VIDE = { nom: "", quantite: "1", prix: "", produit: null, produitId: null, sku: null, options: [] };

// Prise de commande depuis le téléphone, en deux écrans :
// 1. les infos de la commande (nom, téléphone, date et heure, ramassage ou
//    livraison, payée ou non) avec un bouton qui mène aux produits ;
// 2. les produits seulement (produit, quantité, prix), avec "Ajouter" et
//    "Enregistrer" - qui ramène au 1er écran, où le bouton affiche alors le
//    nombre d'articles.
export default function CommandeEmployeModal({ dateParDefaut, onClose, onSaved }) {
  const { t } = useLangue();
  const [vue, setVue] = useState("infos"); // "infos" | "articles"
  const [clientNom, setClientNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [mode, setMode] = useState("ramassage");
  const [paye, setPaye] = useState(false);
  const [dateRamassage, setDateRamassage] = useState(dateParDefaut);
  const [heureRamassage, setHeureRamassage] = useState("12:00");
  const [articles, setArticles] = useState([{ ...ARTICLE_VIDE }]);
  const [produits, setProduits] = useState([]);
  const [ouvert, setOuvert] = useState(null); // ligne dont la liste de produits est ouverte
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    employeFetch("/api/employe-app/commandes/produits")
      .then((res) => res.json())
      .then((data) => setProduits(data.produits || []))
      .catch(() => {});
  }, []);

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
      const separe = a.produit ? separerVariante(a.nom) : { nom: a.nom.trim(), options: a.options || [] };
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
    setBusy(true);
    setErreur("");

    try {
      const res = await employeFetch("/api/employe-app/commandes", {
        method: "POST",
        body: JSON.stringify({
          client_nom: clientNom,
          client_telephone: telephone,
          mode,
          paye,
          date_ramassage: dateRamassage ? versIsoQuebec(dateRamassage, heureRamassage) : null,
          items: articlesValides.map((a) => ({ ...a, prix: Number.isFinite(a.prix) ? a.prix : null })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.error || t("commandes.erreurEnregistrement"));
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
      <div className="modal-card" style={{ maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        {vue === "infos" ? (
          <>
            <div className="modal-head">
              <h3>{t("commandes.nouvelle")}</h3>
              <button type="button" className="admin-icon-btn" onClick={onClose}>
                {t("nav.fermer")}
              </button>
            </div>

            <div className="field">
              <input type="text" value={clientNom} onChange={(e) => setClientNom(e.target.value)} placeholder={t("commandes.nomCommande")} maxLength={120} />
            </div>

            <div className="field">
              <input type="tel" inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder={t("commandes.telephone")} maxLength={40} />
            </div>

            <div className="field">
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 110px", gap: "6px" }}>
                <input type="date" value={dateRamassage} onChange={(e) => setDateRamassage(e.target.value)} aria-label={t("commandes.date")} style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }} />
                <input type="time" value={heureRamassage} onChange={(e) => setHeureRamassage(e.target.value)} disabled={!dateRamassage} aria-label={t("commandes.heure")} style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }} />
              </div>
            </div>

            <div className="field">
              <button type="button" className="submit-btn" style={{ width: "100%" }} onClick={() => setVue("articles")}>
                {nombreArticles > 0
                  ? `${t("commandes.nArticles", { n: nombreArticles })} · ${formatMontant(total)} ›`
                  : `${t("commandes.ajouterProduits")} ›`}
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
            </div>

            {erreur && <p className="settings-msg err">{erreur}</p>}

            <button type="button" className="submit-btn" style={{ width: "100%", marginTop: "6px" }} disabled={busy || nombreArticles === 0} onClick={creerCommande}>
              {busy ? t("commandes.enregistrement") : t("commandes.ajouterCommande")}
            </button>
          </>
        ) : (
          <>
            <div className="modal-head">
              <h3>{t("commandes.articles")}</h3>
              <button type="button" className="admin-icon-btn" onClick={enregistrerArticles}>
                ‹ {t("commandes.retour")}
              </button>
            </div>

            {articles.map((a, i) => (
              <div key={i} style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "stretch" }}>
                  <div className="emplacement-select-wrap" style={{ minWidth: 0, flex: 1 }}>
                    <input
                      type="text"
                      value={a.nom}
                      onChange={(e) => taperNom(i, e.target.value)}
                      onFocus={() => setOuvert(i)}
                      onBlur={() => setTimeout(() => setOuvert((o) => (o === i ? null : o)), 300)}
                      placeholder={t("commandes.produit")}
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
                    style={{ aspectRatio: "1 / 1", flexShrink: 0, padding: 0, borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "6px", marginTop: "6px" }}>
                  <input
                    type="number"
                    min="1"
                    value={a.quantite}
                    onChange={(e) => majArticle(i, "quantite", e.target.value)}
                    placeholder={t("commandes.quantite")}
                    aria-label={t("commandes.quantite")}
                    style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={a.prix}
                    onChange={(e) => majArticle(i, "prix", e.target.value)}
                    placeholder={t("commandes.prix")}
                    aria-label={t("commandes.prix")}
                    style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}
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
    </div>
  );
}
