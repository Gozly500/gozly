"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";
import { formatMontant } from "@/lib/commandes";
import { separerVariante, produitIdWix, versIsoQuebec } from "@/lib/commandesManuelles";

const ARTICLE_VIDE = { nom: "", quantite: "1", prix: "", produit: null, produitId: null, sku: null, options: [] };

// Formulaire pour ajouter une commande / réservation depuis le téléphone :
// mêmes champs que le dashboard (client, ramassage ou livraison, date et heure,
// articles choisis dans l'inventaire, payée ou non).
export default function CommandeEmployeModal({ dateParDefaut, onClose, onSaved }) {
  const { t } = useLangue();
  const [clientNom, setClientNom] = useState("");
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

  const total = articlesValides.reduce((somme, a) => somme + a.quantite * (Number.isFinite(a.prix) ? a.prix : 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
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
      <div className="modal-card" style={{ maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("commandes.nouvelle")}</h3>
          <button type="button" className="admin-icon-btn" onClick={onClose}>
            {t("nav.fermer")}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{t("commandes.client")}</label>
            <input type="text" value={clientNom} onChange={(e) => setClientNom(e.target.value)} maxLength={120} />
          </div>

          <div className="field">
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" className="admin-icon-btn" style={boutonChoix(mode === "ramassage")} onClick={() => setMode("ramassage")}>
                {t("commandes.ramassage")}
              </button>
              <button type="button" className="admin-icon-btn" style={boutonChoix(mode === "livraison")} onClick={() => setMode("livraison")}>
                {t("commandes.livraison")}
              </button>
            </div>
          </div>

          <div className="field">
            <label>{t("commandes.dateHeure")}</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: "8px" }}>
              <input type="date" value={dateRamassage} onChange={(e) => setDateRamassage(e.target.value)} />
              <input type="time" value={heureRamassage} onChange={(e) => setHeureRamassage(e.target.value)} disabled={!dateRamassage} />
            </div>
          </div>

          <div className="field">
            <label>{t("commandes.articles")}</label>
            {articles.map((a, i) => (
              <div key={i} style={{ marginBottom: "12px" }}>
                <div className="emplacement-select-wrap" style={{ minWidth: 0 }}>
                  <input
                    type="text"
                    value={a.nom}
                    onChange={(e) => taperNom(i, e.target.value)}
                    onFocus={() => setOuvert(i)}
                    onBlur={() => setTimeout(() => setOuvert((o) => (o === i ? null : o)), 300)}
                    placeholder={t("commandes.chercherProduit")}
                    autoComplete="off"
                  />
                  {ouvert === i && (
                    <div className="emplacement-select-options" style={{ maxHeight: "200px", overflowY: "auto" }}>
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
                <div style={{ display: "flex", gap: "8px", marginTop: "6px", alignItems: "center" }}>
                  <input
                    type="number"
                    min="1"
                    value={a.quantite}
                    onChange={(e) => majArticle(i, "quantite", e.target.value)}
                    aria-label={t("commandes.quantite")}
                    style={{ width: "70px" }}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={a.prix}
                    onChange={(e) => majArticle(i, "prix", e.target.value)}
                    placeholder={t("commandes.prix")}
                    aria-label={t("commandes.prix")}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="button"
                    className="admin-icon-btn danger"
                    onClick={() => setArticles((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [{ ...ARTICLE_VIDE }]))}
                    aria-label={t("commandes.retirerArticle")}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="admin-icon-btn" onClick={() => setArticles((prev) => [...prev, { ...ARTICLE_VIDE }])}>
              + {t("commandes.ajouterArticle")}
            </button>
          </div>

          <div className="field">
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" className="admin-icon-btn" style={boutonChoix(paye)} onClick={() => setPaye(true)}>
                {t("commandes.payee")}
              </button>
              <button type="button" className="admin-icon-btn" style={boutonChoix(!paye)} onClick={() => setPaye(false)}>
                {t("commandes.aPayer")}
              </button>
            </div>
          </div>

          <p style={{ fontWeight: 700, margin: "12px 0" }}>
            {t("commandes.total")} : {formatMontant(total)}
          </p>
          {erreur && <p className="settings-msg err">{erreur}</p>}

          <button type="submit" className="submit-btn" style={{ width: "100%" }} disabled={busy}>
            {busy ? t("commandes.enregistrement") : t("commandes.ajouterCommande")}
          </button>
        </form>
      </div>
    </div>
  );
}
