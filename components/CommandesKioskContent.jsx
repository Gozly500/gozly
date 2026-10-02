"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import CommandeManuelleModal from "@/components/commandes/CommandeManuelleModal";
import { synchroniserCommandes, changerEtapeCommande } from "@/lib/commandesClient";
import {
  formatMontant,
  dateAujourdhui,
  bornesJour,
  heureCommande,
  libelleMode,
  libellePaiement,
  etapeCommande,
} from "@/lib/commandes";

const INTERVALLE_SYNC_MS = 30000;

const COLONNES = [
  { id: "en_attente", titre: "En attente", suivante: "traitee", libelleBouton: "Traiter →", couleur: "#ffd479" },
  { id: "traitee", titre: "Traitées", suivante: "terminee", libelleBouton: "Terminer ✓", couleur: "#8ab4ff" },
  { id: "terminee", titre: "Terminées", suivante: null, libelleBouton: null, couleur: "#7ee2a8" },
];

// Petit bip pour signaler une nouvelle commande (les navigateurs exigent
// qu'on ait déjà touché la page une fois pour jouer un son - sans effet sinon).
function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.15);
    }
  } catch {}
}

export default function CommandesKioskContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [entrepriseNom, setEntrepriseNom] = useState("");
  const [commandes, setCommandes] = useState([]);
  const [modal, setModal] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const dejaVuesRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }

      const { entrepriseId: eid, besoinChoix } = await resoudreEntrepriseActive(supabase);
      if (ignore) return;

      if (besoinChoix) {
        router.push("/dashboards");
        return;
      }

      if (eid) {
        setEntrepriseId(eid);
        const { data } = await supabase.from("entreprises").select("nom").eq("id", eid).maybeSingle();
        if (!ignore) setEntrepriseNom(data?.nom || "");
      }
      setChecking(false);
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  // Les commandes des dernières 36 h : assez pour ne pas perdre de vue une
  // commande de la veille encore pas terminée, sans afficher tout l'historique.
  const charger = useCallback(async () => {
    if (!entrepriseId) return;
    const depuis = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const { data } = await supabase
      .from("commandes_en_ligne")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date_commande", depuis)
      .order("date_commande", { ascending: true });

    const liste = data || [];
    setCommandes(liste);

    // Bip pour toute commande en attente qu'on n'avait pas encore vue
    // (pas au tout premier chargement de la page).
    const attente = liste.filter((c) => etapeCommande(c) === "en_attente").map((c) => c.id);
    if (dejaVuesRef.current !== null && attente.some((id) => !dejaVuesRef.current.has(id))) bip();
    dejaVuesRef.current = new Set([...(dejaVuesRef.current || []), ...attente]);
  }, [entrepriseId]);

  useEffect(() => {
    if (!entrepriseId) return;
    let actif = true;
    async function cycle() {
      await synchroniserCommandes(entrepriseId); // muet si Wix n'est pas connecté
      if (actif) await charger();
    }
    charger();
    cycle();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") cycle();
    }, INTERVALLE_SYNC_MS);
    return () => {
      actif = false;
      clearInterval(id);
    };
  }, [entrepriseId, charger]);

  async function passer(commande, etape) {
    setEnCours(commande.id);
    // Mise à jour immédiate à l'écran, puis confirmation du serveur.
    setCommandes((prev) => prev.map((c) => (c.id === commande.id ? { ...c, etape } : c)));
    await changerEtapeCommande(entrepriseId, commande.id, etape);
    await charger();
    setEnCours(null);
  }

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  if (!entrepriseId) {
    return (
      <div className="kiosk-screen">
        <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
      </div>
    );
  }

  const debutAujourdhui = bornesJour(dateAujourdhui()).debut;
  const visibles = commandes.filter((c) => etapeCommande(c) !== "annulee");

  return (
    <div className="cmd-kiosk">
      <header className="cmd-kiosk-head">
        <div>
          <div className="kiosk-entreprise">{entrepriseNom}</div>
          <h2>Commandes en ligne</h2>
        </div>
        <button className="submit-btn" onClick={() => setModal(true)}>
          + Nouvelle commande
        </button>
      </header>

      <div className="cmd-kiosk-cols">
        {COLONNES.map((col) => {
          const liste = visibles.filter(
            (c) => etapeCommande(c) === col.id && (col.id !== "terminee" || c.date_commande >= debutAujourdhui)
          );
          return (
            <section className="cmd-kiosk-col" key={col.id}>
              <div className="cmd-kiosk-col-head" style={{ borderColor: col.couleur }}>
                <span>{col.titre}</span>
                <span className="cmd-kiosk-count">{liste.length}</span>
              </div>

              {liste.length === 0 && <p className="cmd-kiosk-vide">Aucune commande</p>}

              {liste.map((c) => {
                const mode = libelleMode(c.mode);
                const paiement = libellePaiement(c);
                return (
                  <article className="cmd-kiosk-card" key={c.id}>
                    <div className="cmd-kiosk-card-top">
                      <strong>#{c.numero || "—"}</strong>
                      <span>{heureCommande(c.date_commande)}</span>
                    </div>
                    {c.client_nom && <div className="cmd-kiosk-client">{c.client_nom}</div>}
                    <div className="cmd-kiosk-tags">
                      {mode && <span className="cmd-kiosk-tag">{mode}</span>}
                      {paiement && <span className="cmd-kiosk-tag">{paiement}</span>}
                      {c.source === "manuel" && <span className="cmd-kiosk-tag">Manuelle</span>}
                    </div>
                    <div className="cmd-kiosk-items">
                      {(c.items || []).map((it, i) => (
                        <div key={i}>
                          <strong>{it.quantite} ×</strong> {it.nom}
                          {it.options?.length > 0 && <div className="cmd-kiosk-options">{it.options.join(", ")}</div>}
                        </div>
                      ))}
                    </div>
                    <div className="cmd-kiosk-total">{formatMontant(c.total)}</div>

                    <div className="cmd-kiosk-actions">
                      {col.id !== "en_attente" && (
                        <button
                          className="admin-icon-btn"
                          disabled={enCours === c.id}
                          onClick={() => passer(c, col.id === "terminee" ? "traitee" : "en_attente")}
                        >
                          ← Retour
                        </button>
                      )}
                      {col.suivante && (
                        <button
                          className="submit-btn"
                          disabled={enCours === c.id}
                          onClick={() => passer(c, col.suivante)}
                        >
                          {col.libelleBouton}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>

      {modal && (
        <CommandeManuelleModal
          entrepriseId={entrepriseId}
          commande={null}
          onClose={() => setModal(false)}
          onSaved={() => {
            setModal(false);
            charger();
          }}
        />
      )}
    </div>
  );
}
