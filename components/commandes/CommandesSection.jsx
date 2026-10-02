"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { IconIntegration } from "@/components/icons/GozlyIcons";
import CommandeManuelleModal from "@/components/commandes/CommandeManuelleModal";
import {
  formatMontant,
  dateAujourdhui,
  decalerJour,
  bornesJour,
  heureCommande,
  libelleMode,
  etatCommande,
  libellePaiement,
} from "@/lib/commandes";

const INTERVALLE_SYNC_MS = 30000;

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function CommandesSection({ entrepriseId }) {
  const [date, setDate] = useState(dateAujourdhui);
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [filtre, setFiltre] = useState("toutes");
  const [modal, setModal] = useState(null);
  const dateRef = useRef(date);
  dateRef.current = date;

  const charger = useCallback(async () => {
    const { debut, fin } = bornesJour(dateRef.current);
    const { data } = await supabase
      .from("commandes_en_ligne")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date_commande", debut)
      .lt("date_commande", fin)
      .order("date_commande", { ascending: false });
    setCommandes(data || []);
    setLoading(false);
  }, [entrepriseId]);

  const synchroniser = useCallback(
    async ({ silencieux = false } = {}) => {
      if (!silencieux) setSyncing(true);
      try {
        const res = await fetch("/api/commandes/synchroniser", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ entrepriseId }),
        });
        const data = await res.json();
        if (!res.ok) {
          // La synchro automatique reste muette (ex: Wix pas connecté, mais
          // des commandes manuelles à afficher) ; seul le bouton montre l'erreur.
          if (!silencieux) {
            setSyncMsg({
              type: "err",
              text: `${data.error || "La synchronisation a échoué."}${data.detail ? ` [${data.detail}]` : ""}`,
            });
          }
        } else {
          setSyncMsg(silencieux ? null : { type: "ok", text: `${data.count} commande(s) synchronisée(s) depuis Wix.` });
          await charger();
        }
      } catch {
        if (!silencieux) setSyncMsg({ type: "err", text: "La synchronisation a échoué." });
      }
      if (!silencieux) setSyncing(false);
    },
    [entrepriseId, charger]
  );

  // Au changement de jour : relit la table (instantané).
  useEffect(() => {
    setLoading(true);
    charger();
  }, [date, charger]);

  // Au montage : synchronise tout de suite, puis aux 30 s tant que la page
  // est visible (pas de sync pour un onglet en arrière-plan).
  useEffect(() => {
    synchroniser({ silencieux: true });
    const id = setInterval(() => {
      if (document.visibilityState === "visible") synchroniser({ silencieux: true });
    }, INTERVALLE_SYNC_MS);
    return () => clearInterval(id);
  }, [synchroniser]);

  async function basculerTerminee(c) {
    const termine = c.statut_preparation === "FULFILLED";
    await supabase
      .from("commandes_en_ligne")
      .update({ statut_preparation: termine ? "NOT_FULFILLED" : "FULFILLED", updated_at: new Date().toISOString() })
      .eq("id", c.id);
    charger();
  }

  async function retirer(c) {
    if (!window.confirm(`Retirer la commande #${c.numero}?`)) return;
    await supabase.from("commandes_en_ligne").delete().eq("id", c.id);
    charger();
  }

  const aujourdhui = dateAujourdhui();
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const visibles = commandes.filter((c) => {
    if (filtre === "a-preparer") return etatCommande(c).texte === "À préparer";
    if (filtre === "terminees") return etatCommande(c).texte === "Terminée";
    if (filtre === "annulees") return c.statut === "CANCELED";
    return true;
  });
  const valides = commandes.filter((c) => c.statut !== "CANCELED");
  const totalJour = valides.reduce((sum, c) => sum + Number(c.total), 0);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2>Commandes en ligne</h2>
          <p className="panel-hint" style={{ marginBottom: 0 }}>
            Les commandes reçues sur ton site Wix, mises à jour automatiquement.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="submit-btn" onClick={() => setModal({ commande: null })}>
            + Nouvelle commande
          </button>
          <button className="admin-icon-btn" onClick={() => synchroniser()} disabled={syncing}>
            <IconIntegration className="gozly-icon" /> {syncing ? "Synchronisation..." : "Synchroniser Wix"}
          </button>
        </div>
      </div>

      {syncMsg && <p className={`settings-msg ${syncMsg.type}`}>{syncMsg.text}</p>}

      <div className="planning-week-nav">
        <button className="admin-icon-btn" onClick={() => setDate((d) => decalerJour(d, -1))}>
          ‹ Jour précédent
        </button>
        <span className="planning-week-label" style={{ textTransform: "capitalize" }}>
          {dateLabel}
          {date !== aujourdhui && (
            <button className="admin-icon-btn" style={{ marginLeft: "10px" }} onClick={() => setDate(aujourdhui)}>
              Aujourd&apos;hui
            </button>
          )}
        </span>
        <button className="admin-icon-btn" onClick={() => setDate((d) => decalerJour(d, 1))}>
          Jour suivant ›
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : commandes.length === 0 ? (
        <div className="admin-list" style={{ maxWidth: "700px" }}>
          <div className="admin-empty">Aucune commande ce jour-là.</div>
        </div>
      ) : (
        <>
          <div className="admin-list" style={{ maxWidth: "500px", marginBottom: "16px" }}>
            <div className="admin-row">
              <div className="admin-row-main">
                <div className="admin-row-title">Commandes</div>
              </div>
              <div className="admin-row-controls">{valides.length}</div>
            </div>
            <div className="admin-row">
              <div className="admin-row-main">
                <div className="admin-row-title">Total (sans les annulées)</div>
              </div>
              <div className="admin-row-controls" style={{ fontWeight: 700 }}>
                {formatMontant(totalJour)}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
            {[
              ["toutes", "Toutes"],
              ["a-preparer", "À préparer"],
              ["terminees", "Terminées"],
              ["annulees", "Annulées"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={`admin-icon-btn${filtre === id ? " active" : ""}`}
                style={filtre === id ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
                onClick={() => setFiltre(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="admin-list" style={{ maxWidth: "700px" }}>
            {visibles.length === 0 && <div className="admin-empty">Aucune commande dans ce filtre.</div>}
            {visibles.map((c) => {
              const etat = etatCommande(c);
              const mode = libelleMode(c.mode);
              const paiement = libellePaiement(c);
              return (
                <div className="admin-row" key={c.id} style={{ alignItems: "flex-start" }}>
                  <div className="admin-row-main">
                    <div className="admin-row-title">
                      #{c.numero || "—"} · {heureCommande(c.date_commande)}
                      {c.client_nom ? ` · ${c.client_nom}` : ""}
                    </div>
                    <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
                      <span style={{ color: etat.couleur, fontWeight: 600 }}>{etat.texte}</span>
                      {mode && ` · ${mode}`}
                      {paiement && ` · ${paiement}`}
                      {c.source === "manuel" && " · Manuelle"}
                    </div>
                    {(c.items || []).map((it, i) => (
                      <div key={i} style={{ fontSize: "13.5px" }}>
                        {it.quantite} × {it.nom}
                        {it.options?.length > 0 && (
                          <span style={{ color: "var(--text-dim)", fontSize: "12.5px" }}> ({it.options.join(", ")})</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="admin-row-controls" style={{ flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                    <span style={{ fontWeight: 700 }}>{formatMontant(c.total)}</span>
                    {c.source === "manuel" && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button className="admin-icon-btn" onClick={() => basculerTerminee(c)}>
                          {c.statut_preparation === "FULFILLED" ? "Rouvrir" : "Terminée"}
                        </button>
                        <button className="admin-icon-btn" onClick={() => setModal({ commande: c })}>
                          Modifier
                        </button>
                        <button className="admin-icon-btn danger" onClick={() => retirer(c)}>
                          Retirer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {modal && (
        <CommandeManuelleModal
          entrepriseId={entrepriseId}
          commande={modal.commande}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            charger();
          }}
        />
      )}
    </div>
  );
}
