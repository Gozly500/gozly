"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import CommandeEmployeModal from "@/components/moi/CommandeEmployeModal";
import { LangueProvider } from "@/components/moi/LangueContext";
import { chargerProduitsInventaire, creerCommandeManuelle } from "@/lib/commandesNouvelle";
import { synchroniserCommandes, changerEtapeCommande, imprimerCommande, impressionActive } from "@/lib/commandesClient";
import {
  formatMontant,
  dateAujourdhui,
  bornesJour,
  heureCommande,
  libelleMode,
  libellePaiement,
  etapeCommande,
  dateEffective,
  libelleRamassage,
  noteCommande,
} from "@/lib/commandes";

const INTERVALLE_SYNC_MS = 30000;

const COLONNES = [
  { id: "en_attente", titre: "En attente", suivante: "traitee", libelleBouton: "Traiter →", couleur: "#ffd479" },
  { id: "traitee", titre: "Traitées", suivante: "terminee", libelleBouton: "Terminer ✓", couleur: "#8ab4ff" },
  { id: "terminee", titre: "Terminées", suivante: null, libelleBouton: null, couleur: "#7ee2a8" },
];

const SON_NOUVELLE_COMMANDE = "/sons/nouvelle-commande.mp3";
const PAUSE_ENTRE_SONS_MS = 5000;

export default function CommandesKioskContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [entrepriseNom, setEntrepriseNom] = useState("");
  const [commandes, setCommandes] = useState([]);
  const [modal, setModal] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const [imprimanteActive, setImprimanteActive] = useState(false);
  const [message, setMessage] = useState(null);
  const [sonActif, setSonActif] = useState(false);
  const audioRef = useRef(null);

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
    // Aujourd'hui et avant seulement : une précommande pour la semaine
    // prochaine n'a pas sa place sur l'écran de la cuisine aujourd'hui.
    const finAujourdhui = bornesJour(dateAujourdhui()).fin;
    const { data } = await supabase
      .from("commandes_en_ligne")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .neq("canal", "POS") // les ventes du point de vente ne passent pas par la cuisine
      .or(
        `and(date_ramassage.gte.${depuis},date_ramassage.lt.${finAujourdhui}),and(date_ramassage.is.null,date_commande.gte.${depuis})`
      );

    // Ordre chronologique du ramassage (ou de la commande sans ramassage).
    const liste = (data || []).sort((a, b) => new Date(dateEffective(a)) - new Date(dateEffective(b)));
    setCommandes(liste);

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

  useEffect(() => {
    if (entrepriseId) impressionActive(entrepriseId).then(setImprimanteActive);
  }, [entrepriseId]);

  const nbEnAttente = commandes.filter((c) => etapeCommande(c) === "en_attente").length;

  // Son en boucle tant qu'une commande attend : on le joue, et 5 secondes
  // après la fin on le rejoue, jusqu'à ce que plus rien ne soit "En attente".
  // (Un navigateur n'autorise le son qu'après un toucher : bouton "Activer le son".)
  useEffect(() => {
    if (!sonActif || nbEnAttente === 0) return;
    if (!audioRef.current) audioRef.current = new Audio(SON_NOUVELLE_COMMANDE);
    const audio = audioRef.current;
    let minuteur;
    let actif = true;

    function jouer() {
      if (!actif) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
    function apresFin() {
      if (actif) minuteur = setTimeout(jouer, PAUSE_ENTRE_SONS_MS);
    }

    audio.addEventListener("ended", apresFin);
    jouer();

    return () => {
      actif = false;
      clearTimeout(minuteur);
      audio.removeEventListener("ended", apresFin);
      audio.pause();
    };
  }, [sonActif, nbEnAttente > 0]);

  async function imprimer(commande) {
    const { ok, error } = await imprimerCommande(entrepriseId, commande.id, "manuel");
    setMessage(
      ok
        ? { type: "ok", text: `Bon #${commande.numero} envoyé à l'imprimante.` }
        : { type: "err", text: error || "L'impression a échoué." }
    );
    setTimeout(() => setMessage(null), 4000);
  }

  async function passer(commande, etape) {
    setEnCours(commande.id);
    // Mise à jour immédiate à l'écran, puis confirmation du serveur.
    setCommandes((prev) => prev.map((c) => (c.id === commande.id ? { ...c, etape } : c)));
    const { ok, error } = await changerEtapeCommande(entrepriseId, commande.id, etape);
    if (!ok) {
      setMessage({ type: "err", text: error });
      setTimeout(() => setMessage(null), 8000);
    }
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
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            className="admin-icon-btn"
            onClick={() => setSonActif((v) => !v)}
            style={!sonActif ? { background: "rgba(255,212,121,0.25)", borderColor: "rgba(255,212,121,0.6)" } : undefined}
          >
            {sonActif ? "🔔 Son activé" : "🔕 Activer le son"}
          </button>
          <button className="submit-btn" onClick={() => setModal(true)}>
            + Nouvelle commande
          </button>
        </div>
      </header>

      {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}

      <div className="cmd-kiosk-cols">
        {COLONNES.map((col) => {
          const liste = visibles.filter(
            (c) => etapeCommande(c) === col.id && (col.id !== "terminee" || dateEffective(c) >= debutAujourdhui)
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
                      <span>{libelleRamassage(c) ? `Ramassage ${libelleRamassage(c)}` : heureCommande(c.date_commande)}</span>
                    </div>
                    {c.client_nom && <div className="cmd-kiosk-client">{c.client_nom}</div>}
                    {noteCommande(c) && <div className="cmd-kiosk-note">📝 {noteCommande(c)}</div>}
                    <div className="cmd-kiosk-tags">
                      {mode && <span className="cmd-kiosk-tag">{mode}</span>}
                      {c.lieu_nom && <span className="cmd-kiosk-tag">{c.lieu_nom}</span>}
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
                      {imprimanteActive && (
                        <button className="admin-icon-btn" onClick={() => imprimer(c)} aria-label="Imprimer le bon">
                          🖨
                        </button>
                      )}
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
        <LangueProvider>
          <CommandeEmployeModal
            dateParDefaut={dateAujourdhui()}
            chargerProduits={() => chargerProduitsInventaire(entrepriseId)}
            enregistrer={(c) => creerCommandeManuelle(entrepriseId, c)}
            onClose={() => setModal(false)}
            onSaved={() => {
              setModal(false);
              charger();
            }}
          />
        </LangueProvider>
      )}
    </div>
  );
}
