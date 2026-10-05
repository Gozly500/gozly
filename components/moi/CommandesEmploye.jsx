"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";
import CommandeEmployeModal from "@/components/moi/CommandeEmployeModal";
import { dateAujourdhui, decalerJour, heureCommande, libelleRamassage, formatMontant } from "@/lib/commandes";

// Les téléphones se rafraîchissent tout seuls à cet intervalle tant que la page est visible.
const INTERVALLE_RAFRAICHISSEMENT_MS = 30000;

// Réservations / commandes d'une journée, en lecture seule : on navigue de jour
// en jour (même principe que les tâches) pour voir ce qui est prévu et planifier
// la production. En haut : le total à préparer par produit.
export default function CommandesEmploye() {
  const { t, langue } = useLangue();
  const [date, setDate] = useState(dateAujourdhui);
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);

  async function charger({ silencieux = false } = {}) {
    try {
      const res = await employeFetch(`/api/employe-app/commandes?date=${date}`);
      const data = await res.json();
      setCommandes(data.commandes || []);
    } catch {
      // On garde ce qui est affiché ; le prochain cycle réessaiera.
    }
    if (!silencieux) setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    charger();

    const id = setInterval(() => {
      if (document.visibilityState === "visible") charger({ silencieux: true });
    }, INTERVALLE_RAFRAICHISSEMENT_MS);
    const auRetour = () => {
      if (document.visibilityState === "visible") charger({ silencieux: true });
    };
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("focus", auRetour);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("focus", auRetour);
    };
  }, [date]);

  const aujourdhui = dateAujourdhui();
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(langue === "en" ? "en-CA" : "fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Total à préparer par produit (nom + valeurs d'options).
  const totaux = [];
  const index = new Map();
  for (const c of commandes) {
    for (const it of c.items || []) {
      const options = (it.options || []).join(", ");
      const valeurs = (it.options || []).map((o) => String(o).split(": ").pop()).join(", ").toLowerCase();
      const cle = `${String(it.nom).toLowerCase()}|${valeurs}`;
      if (!index.has(cle)) {
        const ligne = { cle, nom: options ? `${it.nom} (${options})` : it.nom, quantite: 0 };
        index.set(cle, ligne);
        totaux.push(ligne);
      }
      index.get(cle).quantite += Number(it.quantite) || 0;
    }
  }
  totaux.sort((a, b) => a.nom.localeCompare(b.nom, langue === "en" ? "en" : "fr"));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <h2 style={{ margin: 0 }}>{t("commandes.titre")}</h2>
        <button type="button" className="btn-small" onClick={() => setModalOuvert(true)}>
          + {t("commandes.ajouter")}
        </button>
      </div>
      <p className="panel-hint">{t("commandes.hint")}</p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "14px" }}>
        <button type="button" className="admin-icon-btn" aria-label={t("taches.jourPrecedent")} onClick={() => setDate((d) => decalerJour(d, -1))}>
          ‹
        </button>
        <div style={{ textAlign: "center" }}>
          <div className="planning-day-title" style={{ textTransform: "capitalize" }}>
            {dateLabel}
          </div>
          {date !== aujourdhui && (
            <button type="button" className="admin-icon-btn" style={{ marginTop: "6px" }} onClick={() => setDate(aujourdhui)}>
              {t("taches.aujourdhui")}
            </button>
          )}
        </div>
        <button type="button" className="admin-icon-btn" aria-label={t("taches.jourSuivant")} onClick={() => setDate((d) => decalerJour(d, 1))}>
          ›
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>{t("nav.chargement")}</p>
      ) : commandes.length === 0 ? (
        <p className="chat-empty">{t("commandes.aucune")}</p>
      ) : (
        <div className="planning-days">
          <div className="planning-day">
            <div className="planning-day-head">
              <span className="planning-day-title">{t("commandes.aPreparer")}</span>
              <span className="planning-day-date">{t("commandes.nbCommandes", { n: commandes.length })}</span>
            </div>
            {totaux.map((p) => (
              <div key={p.cle} style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "4px 0", fontSize: "14.5px" }}>
                <span>{p.nom}</span>
                <strong>× {p.quantite}</strong>
              </div>
            ))}
          </div>

          {commandes.map((c) => {
            const creneau = libelleRamassage(c);
            const paye = c.statut_paiement === "PAID";
            const nonPaye = c.statut_paiement === "NOT_PAID";
            return (
              <div className="planning-day" key={c.id}>
                <div className="planning-day-head">
                  <span className="planning-day-title">
                    {creneau || heureCommande(c.date_commande)} · #{c.numero || "—"}
                  </span>
                  {(paye || nonPaye) && (
                    <span style={{ fontSize: "12.5px", fontWeight: 600, color: paye ? "#7ee2a8" : "#ffd479" }}>
                      {paye ? t("commandes.payee") : t("commandes.aPayer")}
                    </span>
                  )}
                </div>
                {c.client_nom && <div style={{ fontWeight: 600, marginBottom: "4px" }}>{c.client_nom}</div>}
                {c.client_telephone && (
                  <div style={{ marginBottom: "4px", fontSize: "13.5px" }}>
                    <a href={`tel:${c.client_telephone}`} style={{ color: "inherit", textDecoration: "underline" }}>
                      {c.client_telephone}
                    </a>
                  </div>
                )}
                {c.note && <div style={{ marginBottom: "6px", fontSize: "13.5px", color: "#ffd479" }}>📝 {c.note}</div>}
                {(c.mode === "ramassage" || c.mode === "livraison" || c.lieu_nom) && (
                  <div className="section-hint" style={{ margin: "0 0 8px" }}>
                    {[c.mode === "ramassage" ? t("commandes.ramassage") : c.mode === "livraison" ? t("commandes.livraison") : null, c.lieu_nom]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
                {(c.items || []).map((it, i) => (
                  <div key={i} style={{ fontSize: "14.5px", padding: "2px 0" }}>
                    <strong>{it.quantite} ×</strong> {it.nom}
                    {it.options?.length > 0 && (
                      <div style={{ color: "var(--text-dim)", fontSize: "12.5px", paddingLeft: "18px" }}>{it.options.join(", ")}</div>
                    )}
                  </div>
                ))}
                <div style={{ marginTop: "8px", fontWeight: 700, textAlign: "right" }}>{formatMontant(c.total)}</div>
              </div>
            );
          })}
        </div>
      )}

      {modalOuvert && (
        <CommandeEmployeModal
          dateParDefaut={date}
          onClose={() => setModalOuvert(false)}
          onSaved={() => {
            setModalOuvert(false);
            charger();
          }}
        />
      )}
    </div>
  );
}
