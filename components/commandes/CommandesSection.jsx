"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { changerEtapeCommande, imprimerCommande, impressionActive, mettreAJourTachesCommandes } from "@/lib/commandesClient";
import { supabase } from "@/lib/supabaseClient";
import { IconIntegration, IconTableauDeBord, IconCommandes } from "@/components/icons/GozlyIcons";
import CommandeManuelleModal from "@/components/commandes/CommandeManuelleModal";
import PlanificationBoite from "@/components/commandes/PlanificationBoite";
import { telechargerPdfCommandes } from "@/lib/exportPdf";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";
import {
  formatMontant,
  dateAujourdhui,
  decalerJour,
  bornesJour,
  heureCommande,
  libelleMode,
  filtrerParDateEffective,
  dateEffective,
  libelleRamassage,
  etatCommande,
  etapeCommande,
  libellePaiement,
  noteCommande,
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
  const [vue, setVue] = useState("apercu"); // "apercu" ou "commandes"
  // Boîte "Planification" (Personnalisation > Commandes en ligne) : seulement si
  // le réglage est activé ET que le module Tâches est actif.
  const [planifActive, setPlanifActive] = useState(false);
  const [premierJourDimanche, setPremierJourDimanche] = useState(false);
  const [modal, setModal] = useState(null);
  const [imprimanteActive, setImprimanteActive] = useState(false);
  const [entrepriseNom, setEntrepriseNom] = useState("");
  const [exportEnCours, setExportEnCours] = useState(false);
  const [exportOuvert, setExportOuvert] = useState(false);
  const exportRef = useRef(null);
  useFermerAuClicExterieur(exportRef, exportOuvert, () => setExportOuvert(false));
  const dateRef = useRef(date);
  dateRef.current = date;

  const charger = useCallback(async () => {
    const { debut, fin } = bornesJour(dateRef.current);
    const { data } = await filtrerParDateEffective(
      supabase.from("commandes_en_ligne").select("*").eq("entreprise_id", entrepriseId).neq("canal", "POS"),
      debut,
      fin
    );
    // Ordre chronologique du ramassage (ou de la commande s'il n'y a pas de ramassage).
    setCommandes((data || []).sort((a, b) => new Date(dateEffective(a)) - new Date(dateEffective(b))));
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

  useEffect(() => {
    impressionActive(entrepriseId).then(setImprimanteActive);

    Promise.all([
      supabase.from("entreprises").select("nom, commandes_planning_integre, premier_jour_semaine").eq("id", entrepriseId).maybeSingle(),
      supabase.from("modules_actifs").select("module").eq("entreprise_id", entrepriseId).eq("module", "planning"),
    ]).then(([{ data: entreprise }, { data: modules }]) => {
      setPlanifActive(!!entreprise?.commandes_planning_integre && (modules || []).length > 0);
      setPremierJourDimanche(entreprise?.premier_jour_semaine === "dimanche");
      setEntrepriseNom(entreprise?.nom || "");
    });
  }, [entrepriseId]);

  async function imprimer(c) {
    const { ok, error } = await imprimerCommande(entrepriseId, c.id, "manuel");
    setSyncMsg(
      ok
        ? { type: "ok", text: `Bon de la commande #${c.numero} envoyé à l'imprimante.` }
        : { type: "err", text: error || "L'impression a échoué." }
    );
  }

  async function passerEtape(c, etape) {
    const { ok, error } = await changerEtapeCommande(entrepriseId, c.id, etape);
    if (!ok) setSyncMsg({ type: "err", text: error });
    charger();
  }

  async function retirer(c) {
    if (!window.confirm(`Retirer la commande #${c.numero}?`)) return;
    await supabase.from("commandes_en_ligne").delete().eq("id", c.id);
    await mettreAJourTachesCommandes(entrepriseId);
    charger();
  }

  const dateLabelPdf = () => new Date(`${date}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  async function exporterPdf() {
    setExportEnCours(true);
    try {
      await telechargerPdfCommandes({ entrepriseNom, dateLabel: dateLabelPdf(), dateIso: date, commandes, totauxProduits });
    } finally {
      setExportEnCours(false);
    }
  }

  const aujourdhui = dateAujourdhui();
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const visibles = commandes.filter((c) => {
    if (filtre === "toutes") return true;
    return etapeCommande(c) === filtre;
  });
  const valides = commandes.filter((c) => c.statut !== "CANCELED");

  // Total à préparer par produit (nom + valeurs d'options) pour la page Aperçu,
  // même regroupement que les tâches automatiques.
  const totauxProduits = [];
  const indexProduits = new Map();
  for (const c of valides) {
    for (const it of c.items || []) {
      const options = (it.options || []).join(", ");
      const valeurs = (it.options || []).map((o) => String(o).split(": ").pop()).join(", ").toLowerCase();
      const cle = `${String(it.nom).toLowerCase()}|${valeurs}`;
      if (!indexProduits.has(cle)) {
        const ligne = { cle, nom: options ? `${it.nom} (${options})` : it.nom, quantite: 0 };
        indexProduits.set(cle, ligne);
        totauxProduits.push(ligne);
      }
      indexProduits.get(cle).quantite += Number(it.quantite) || 0;
    }
  }
  totauxProduits.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const totalJour = valides.reduce((sum, c) => sum + Number(c.total), 0);

  return (
    <div className={planifActive ? "cmd-avec-planif" : undefined}>
      <div className="cmd-principal">
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
          <div className="account-wrap" ref={exportRef}>
            <button className="admin-icon-btn" onClick={() => setExportOuvert((v) => !v)} disabled={exportEnCours || commandes.length === 0}>
              {exportEnCours ? "PDF..." : "⬇ Exporter ▾"}
            </button>
            {exportOuvert && (
              <div className="account-dropdown open">
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setExportOuvert(false);
                    exporterPdf();
                  }}
                >
                  PDF (commandes du jour)
                </button>
              </div>
            )}
          </div>
          <button className="admin-icon-btn" onClick={() => synchroniser()} disabled={syncing}>
            <IconIntegration className="gozly-icon" /> {syncing ? "Synchronisation..." : "Synchroniser Wix"}
          </button>
        </div>
      </div>

      {syncMsg && <p className={`settings-msg ${syncMsg.type}`}>{syncMsg.text}</p>}

      <div className="settings-nav horaire-tabs-sticky" style={{ flexDirection: "row", width: "fit-content" }}>
        {[
          { id: "apercu", label: "Aperçu", Icone: IconTableauDeBord },
          { id: "commandes", label: "Commandes", Icone: IconCommandes },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`settings-nav-item${vue === tab.id ? " active" : ""}`}
            onClick={() => setVue(tab.id)}
          >
            <span className="icon">
              <tab.Icone className="gozly-icon" />
            </span>{" "}
            {tab.label}
          </button>
        ))}
      </div>

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
      ) : vue === "apercu" ? (
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", maxWidth: "700px", marginBottom: "24px" }}>
            {[
              ["en_attente", "En attente"],
              ["traitee", "Traitées"],
              ["terminee", "Terminées"],
              ["annulee", "Annulées"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="settings-section"
                style={{ margin: 0, padding: "14px 16px", textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit" }}
                onClick={() => {
                  setFiltre(id);
                  setVue("commandes");
                }}
              >
                <div style={{ fontSize: "26px", fontWeight: 700 }}>{commandes.filter((c) => etapeCommande(c) === id).length}</div>
                <div className="section-hint" style={{ margin: 0 }}>
                  {label}
                </div>
              </button>
            ))}
          </div>

          <h3 style={{ marginBottom: "10px" }}>À préparer ce jour-là</h3>
          {totauxProduits.length === 0 ? (
            <div className="admin-list" style={{ maxWidth: "700px" }}>
              <div className="admin-empty">Aucun produit à préparer.</div>
            </div>
          ) : (
            <div className="admin-list" style={{ maxWidth: "700px" }}>
              {totauxProduits.map((p) => (
                <div className="admin-row" key={p.cle}>
                  <div className="admin-row-main">
                    <div className="admin-row-title">{p.nom}</div>
                  </div>
                  <div className="admin-row-controls" style={{ fontWeight: 700 }}>
                    × {p.quantite}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
            {[
              ["toutes", "Toutes"],
              ["en_attente", "En attente"],
              ["traitee", "Traitées"],
              ["terminee", "Terminées"],
              ["annulee", "Annulées"],
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
                      #{c.numero || "—"} · {libelleRamassage(c) ? `Ramassage ${libelleRamassage(c)}` : heureCommande(c.date_commande)}
                      {c.client_nom ? ` · ${c.client_nom}` : ""}
                      {c.client_telephone ? ` · ${c.client_telephone}` : ""}
                    </div>
                    <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
                      <span style={{ color: etat.couleur, fontWeight: 600 }}>{etat.texte}</span>
                      {mode && ` · ${mode}`}
                      {c.lieu_nom && ` · ${c.lieu_nom}`}
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
                    {noteCommande(c) && <div style={{ fontSize: "13px", marginTop: "6px", color: "#ffd479" }}>📝 {noteCommande(c)}</div>}
                  </div>
                  <div className="admin-row-controls" style={{ flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                    <span style={{ fontWeight: 700 }}>{formatMontant(c.total)}</span>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {etat.id === "en_attente" && (
                        <button className="admin-icon-btn" onClick={() => passerEtape(c, "traitee")}>
                          Traiter
                        </button>
                      )}
                      {etat.id === "traitee" && (
                        <button className="admin-icon-btn" onClick={() => passerEtape(c, "terminee")}>
                          Terminer
                        </button>
                      )}
                      {imprimanteActive && etat.id !== "annulee" && (
                        <button className="admin-icon-btn" onClick={() => imprimer(c)}>
                          {c.imprime_le ? "Réimprimer" : "Imprimer"}
                        </button>
                      )}
                      {(etat.id === "traitee" || etat.id === "terminee") && (
                        <button className="admin-icon-btn" onClick={() => passerEtape(c, "en_attente")}>
                          Rouvrir
                        </button>
                      )}
                      {c.source === "manuel" && (
                        <>
                          <button className="admin-icon-btn" onClick={() => setModal({ commande: c })}>
                            Modifier
                          </button>
                          <button className="admin-icon-btn danger" onClick={() => retirer(c)}>
                            Retirer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      </div>

      {planifActive && (
        <PlanificationBoite
          entrepriseId={entrepriseId}
          date={date}
          onChangerDate={setDate}
          versionCommandes={commandes.length}
          premierJourDimanche={premierJourDimanche}
        />
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
