"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useGestion } from "@/components/gestion/GestionShell";
import CommandeManuelleModal from "@/components/commandes/CommandeManuelleModal";
import CommandeEmployeModal from "@/components/moi/CommandeEmployeModal";
import { changerEtapeCommande, imprimerCommande, impressionActive, mettreAJourTachesCommandes } from "@/lib/commandesClient";
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
} from "@/lib/commandes";

const INTERVALLE_SYNC_MS = 30000;

const FILTRES = [
  ["toutes", "Toutes"],
  ["en_attente", "En attente"],
  ["traitee", "Traitées"],
  ["terminee", "Terminées"],
];

// Commandes pour le téléphone : une carte par commande avec le bouton de l'étape suivante
// bien visible, navigation par jour, filtres, total à préparer par produit.
export default function CommandesGestion() {
  const { entrepriseId } = useGestion();
  const [date, setDate] = useState(dateAujourdhui);
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState("toutes");
  const [message, setMessage] = useState(null);
  const [modal, setModal] = useState(null); // modification d'une commande manuelle
  const [nouvelle, setNouvelle] = useState(false); // formulaire de nouvelle commande
  const [imprimanteActive, setImprimanteActive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const dateRef = useRef(date);
  dateRef.current = date;

  const charger = useCallback(async () => {
    const { debut, fin } = bornesJour(dateRef.current);
    const { data } = await filtrerParDateEffective(
      supabase.from("commandes_en_ligne").select("*").eq("entreprise_id", entrepriseId).neq("canal", "POS"),
      debut,
      fin
    );
    setCommandes((data || []).sort((a, b) => new Date(dateEffective(a)) - new Date(dateEffective(b))));
    setLoading(false);
  }, [entrepriseId]);

  const synchroniser = useCallback(
    async ({ silencieux = false } = {}) => {
      if (!silencieux) setSyncing(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const res = await fetch("/api/commandes/synchroniser", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData?.session?.access_token}` },
          body: JSON.stringify({ entrepriseId }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (!silencieux) setMessage({ type: "ok", text: `${data.count} commande(s) synchronisée(s).` });
          await charger();
        } else if (!silencieux) {
          setMessage({ type: "err", text: data.error || "La synchronisation a échoué." });
        }
      } catch {
        if (!silencieux) setMessage({ type: "err", text: "La synchronisation a échoué." });
      }
      if (!silencieux) setSyncing(false);
    },
    [entrepriseId, charger]
  );

  useEffect(() => {
    setLoading(true);
    charger();
  }, [date, charger]);

  // Synchro Wix au montage puis aux 30 s tant que l'écran est visible.
  useEffect(() => {
    synchroniser({ silencieux: true });
    const id = setInterval(() => {
      if (document.visibilityState === "visible") synchroniser({ silencieux: true });
    }, INTERVALLE_SYNC_MS);
    return () => clearInterval(id);
  }, [synchroniser]);

  useEffect(() => {
    impressionActive(entrepriseId).then(setImprimanteActive);
  }, [entrepriseId]);

  async function passerEtape(c, etape) {
    const { ok, error } = await changerEtapeCommande(entrepriseId, c.id, etape);
    if (!ok) setMessage({ type: "err", text: error });
    charger();
  }

  async function imprimer(c) {
    const { ok, error } = await imprimerCommande(entrepriseId, c.id, "manuel");
    setMessage(
      ok ? { type: "ok", text: `Bon #${c.numero} envoyé à l'imprimante.` } : { type: "err", text: error || "L'impression a échoué." }
    );
  }

  async function retirer(c) {
    if (!window.confirm(`Retirer la commande #${c.numero}?`)) return;
    await supabase.from("commandes_en_ligne").delete().eq("id", c.id);
    await mettreAJourTachesCommandes(entrepriseId);
    charger();
  }

  // Fonctions du formulaire de nouvelle commande (même écrans que l'app employé,
  // mais avec la session du gestionnaire plutôt que les routes employé).
  async function chargerProduits() {
    const { data } = await supabase
      .from("produits_inventaire")
      .select("id, nom, sku, prix, source, source_id")
      .eq("entreprise_id", entrepriseId)
      .order("nom", { ascending: true })
      .limit(1000);
    return data || [];
  }

  async function enregistrerNouvelle(c) {
    const { count } = await supabase
      .from("commandes_en_ligne")
      .select("id", { count: "exact", head: true })
      .eq("entreprise_id", entrepriseId)
      .eq("source", "manuel");
    const total = Math.round(c.items.reduce((somme, it) => somme + it.quantite * (it.prix || 0), 0) * 100) / 100;
    const id = crypto.randomUUID(); // pas de insert().select() : on garde l'id pour l'impression
    const maintenant = new Date().toISOString();
    const telephone = String(c.client_telephone || "").trim();
    const { error } = await supabase.from("commandes_en_ligne").insert({
      id,
      entreprise_id: entrepriseId,
      source: "manuel",
      canal: "MANUEL",
      source_id: crypto.randomUUID(),
      numero: `M${(count || 0) + 1}`,
      statut: "APPROVED",
      statut_paiement: c.paye ? "PAID" : "NOT_PAID",
      statut_preparation: "NOT_FULFILLED",
      etape: "traitee", // saisie par un employé : déjà prise en charge
      mode: c.mode,
      client_nom: String(c.client_nom || "").trim() || null,
      ...(telephone ? { client_telephone: telephone } : {}),
      total,
      items: c.items,
      date_commande: maintenant,
      date_ramassage: c.date_ramassage,
      date_ramassage_fin: null,
      updated_at: maintenant,
    });
    if (error) return { ok: false, error: "Impossible d'enregistrer la commande." };
    await imprimerCommande(entrepriseId, id, "creation");
    await mettreAJourTachesCommandes(entrepriseId);
    return { ok: true };
  }

  const aujourdhui = dateAujourdhui();
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
  const valides = commandes.filter((c) => c.statut !== "CANCELED");
  const totalJour = valides.reduce((s, c) => s + Number(c.total), 0);
  const visibles = commandes.filter((c) => filtre === "toutes" || etapeCommande(c) === filtre);

  // Total à préparer par produit (même regroupement que les tâches automatiques).
  const totauxProduits = [];
  const index = new Map();
  for (const c of valides) {
    for (const it of c.items || []) {
      const options = (it.options || []).join(", ");
      const valeurs = (it.options || []).map((o) => String(o).split(": ").pop()).join(", ").toLowerCase();
      const cle = `${String(it.nom).toLowerCase()}|${valeurs}`;
      if (!index.has(cle)) {
        const ligne = { cle, nom: options ? `${it.nom} (${options})` : it.nom, quantite: 0 };
        index.set(cle, ligne);
        totauxProduits.push(ligne);
      }
      index.get(cle).quantite += Number(it.quantite) || 0;
    }
  }
  totauxProduits.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
        <h2 style={{ margin: 0 }}>Commandes</h2>
        <button type="button" className="btn-small" onClick={() => setNouvelle(true)}>
          + Nouvelle
        </button>
      </div>

      <div className="moi-week-nav">
        <button className="admin-icon-btn" onClick={() => setDate((d) => decalerJour(d, -1))}>
          ‹
        </button>
        <span className="moi-week-label" style={{ textTransform: "capitalize" }}>
          {dateLabel}
        </span>
        <button className="admin-icon-btn" onClick={() => setDate((d) => decalerJour(d, 1))}>
          ›
        </button>
      </div>
      {date !== aujourdhui && (
        <div style={{ textAlign: "center", marginTop: "-8px", marginBottom: "12px" }}>
          <button className="admin-icon-btn" onClick={() => setDate(aujourdhui)}>
            Aujourd&apos;hui
          </button>
        </div>
      )}

      {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}

      <div className="gestion-resume">
        <span>
          {valides.length} commande{valides.length > 1 ? "s" : ""} · <strong>{formatMontant(totalJour)}</strong>
        </span>
        <button type="button" className="admin-icon-btn" onClick={() => synchroniser()} disabled={syncing}>
          {syncing ? "..." : "↻ Actualiser"}
        </button>
      </div>

      {totauxProduits.length > 0 && (
        <details className="planning-day gestion-apreparer">
          <summary>À préparer ({totauxProduits.length} produit{totauxProduits.length > 1 ? "s" : ""})</summary>
          {totauxProduits.map((p) => (
            <div className="gestion-ligne-produit" key={p.cle}>
              <span>{p.nom}</span>
              <strong>× {p.quantite}</strong>
            </div>
          ))}
        </details>
      )}

      <div className="gestion-filtres">
        {FILTRES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`admin-icon-btn${filtre === id ? " active" : ""}`}
            style={filtre === id ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
            onClick={() => setFiltre(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : visibles.length === 0 ? (
        <p className="chat-empty">Aucune commande.</p>
      ) : (
        <div className="gestion-cartes">
          {visibles.map((c) => {
            const etat = etatCommande(c);
            const mode = libelleMode(c.mode);
            const paiement = libellePaiement(c);
            return (
              <div className="planning-day gestion-commande" key={c.id}>
                <div className="gestion-commande-tete">
                  <strong>
                    #{c.numero || "—"} · {libelleRamassage(c) ? `Ramassage ${libelleRamassage(c)}` : heureCommande(c.date_commande)}
                  </strong>
                  <span style={{ color: etat.couleur, fontWeight: 600, fontSize: "12.5px", whiteSpace: "nowrap" }}>{etat.texte}</span>
                </div>
                {(c.client_nom || c.client_telephone) && (
                  <div className="gestion-commande-client">
                    {c.client_nom}
                    {c.client_telephone && (
                      <>
                        {c.client_nom ? " · " : ""}
                        <a href={`tel:${c.client_telephone}`} style={{ color: "inherit" }}>
                          {c.client_telephone}
                        </a>
                      </>
                    )}
                  </div>
                )}
                <div className="gestion-commande-sous">
                  {[mode, c.lieu_nom, paiement, c.source === "manuel" ? "Manuelle" : null].filter(Boolean).join(" · ")}
                </div>
                <div className="gestion-commande-items">
                  {(c.items || []).map((it, i) => (
                    <div key={i}>
                      {it.quantite} × {it.nom}
                      {it.options?.length > 0 && <span style={{ color: "var(--text-dim)", fontSize: "12.5px" }}> ({it.options.join(", ")})</span>}
                    </div>
                  ))}
                </div>
                <div className="gestion-commande-pied">
                  <strong>{formatMontant(c.total)}</strong>
                  <div className="gestion-commande-actions">
                    {etat.id === "en_attente" && (
                      <button className="btn-small" onClick={() => passerEtape(c, "traitee")}>
                        Traiter →
                      </button>
                    )}
                    {etat.id === "traitee" && (
                      <button className="btn-small" onClick={() => passerEtape(c, "terminee")}>
                        Terminer ✓
                      </button>
                    )}
                  </div>
                </div>
                <div className="gestion-commande-secondaire">
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
            );
          })}
        </div>
      )}

      {nouvelle && (
        <CommandeEmployeModal
          dateParDefaut={date}
          chargerProduits={chargerProduits}
          enregistrer={enregistrerNouvelle}
          onClose={() => setNouvelle(false)}
          onSaved={() => {
            setNouvelle(false);
            charger();
          }}
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
