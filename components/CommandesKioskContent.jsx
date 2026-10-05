"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
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
  decalerJour,
  bornesJour,
  heureCommande,
  libelleMode,
  libellePaiement,
  etapeCommande,
  etatCommande,
  dateEffective,
  libelleRamassage,
  noteCommande,
} from "@/lib/commandes";

const INTERVALLE_SYNC_MS = 30000;

const COLONNES = [
  { id: "en_attente", titre: "En attente", suivante: "traitee", libelleBouton: "Traiter →", couleur: "#ffd479" },
  { id: "traitee", titre: "Commandes du jour", suivante: "terminee", libelleBouton: "Terminer ✓", couleur: "#8ab4ff" },
  { id: "terminee", titre: "Terminées", suivante: null, libelleBouton: null, couleur: "#7ee2a8" },
];

// Sans accents ni majuscules, pour chercher « eve » et trouver « Ève ».
function normaliser(x) {
  return String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Jour (AAAA-MM-JJ, heure du Québec) d'un instant ISO.
function jourQuebec(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date(iso));
}

// La recherche trouve une commande par nom du client, numéro de téléphone (avec ou sans tirets) ou numéro de commande.
function correspondRecherche(c, recherche) {
  const terme = normaliser(recherche);
  if (!terme) return true;
  if (normaliser(c.client_nom).includes(terme)) return true;
  if (normaliser(c.numero).includes(terme.replace(/^#/, ""))) return true;
  const chiffres = terme.replace(/\D/g, "");
  if (chiffres.length >= 2 && String(c.client_telephone || "").replace(/\D/g, "").includes(chiffres)) return true;
  return false;
}

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
  const [vue, setVue] = useState("jour"); // "jour" | "avenir"
  const [recherche, setRecherche] = useState("");
  const [avenir, setAvenir] = useState([]); // commandes dont le ramassage est après aujourd'hui
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
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

  // Commandes à venir : ramassage à partir de demain (jusqu'à 500, les plus proches d'abord).
  const chargerAvenir = useCallback(async () => {
    if (!entrepriseId) return;
    const debutDemain = bornesJour(dateAujourdhui()).fin;
    const { data } = await supabase
      .from("commandes_en_ligne")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .neq("canal", "POS")
      .gte("date_ramassage", debutDemain)
      .order("date_ramassage", { ascending: true })
      .limit(500);
    setAvenir((data || []).filter((c) => c.statut !== "CANCELED"));
  }, [entrepriseId]);

  useEffect(() => {
    if (!entrepriseId) return;
    let actif = true;
    async function cycle() {
      await synchroniserCommandes(entrepriseId); // muet si Wix n'est pas connecté
      if (actif) {
        await charger();
        await chargerAvenir();
      }
    }
    charger();
    chargerAvenir();
    cycle();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") cycle();
    }, INTERVALLE_SYNC_MS);
    return () => {
      actif = false;
      clearInterval(id);
    };
  }, [entrepriseId, charger, chargerAvenir]);

  useEffect(() => {
    if (entrepriseId) impressionActive(entrepriseId).then(setImprimanteActive);
  }, [entrepriseId]);

  const nbAvenirEnAttente = avenir.filter((c) => etapeCommande(c) === "en_attente").length;
  const nbEnAttente = commandes.filter((c) => etapeCommande(c) === "en_attente").length + nbAvenirEnAttente;

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
    setAvenir((prev) => prev.map((c) => (c.id === commande.id ? { ...c, etape } : c)));
    const { ok, error } = await changerEtapeCommande(entrepriseId, commande.id, etape);
    if (!ok) {
      setMessage({ type: "err", text: error });
      setTimeout(() => setMessage(null), 8000);
    }
    await charger();
    await chargerAvenir();
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
  const visibles = commandes.filter((c) => etapeCommande(c) !== "annulee" && correspondRecherche(c, recherche));

  // Commandes à venir filtrées (dates + recherche) et regroupées par jour de ramassage.
  const avenirFiltre = avenir.filter((c) => {
    const jour = jourQuebec(c.date_ramassage);
    if (du && jour < du) return false;
    if (au && jour > au) return false;
    return correspondRecherche(c, recherche);
  });
  const jours = [];
  for (const c of avenirFiltre) {
    const jour = jourQuebec(c.date_ramassage);
    let groupe = jours[jours.length - 1];
    if (!groupe || groupe.jour !== jour) {
      groupe = { jour, commandes: [] };
      jours.push(groupe);
    }
    groupe.commandes.push(c);
  }
  const demain = decalerJour(dateAujourdhui(), 1);

  return (
    <div className="cmd-kiosk">
      <header className="cmd-kiosk-head">
        <div>
          <div className="kiosk-entreprise">{entrepriseNom}</div>
          <h2>Commandes en ligne</h2>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="search"
            className="cmd-kiosk-recherche"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (nom, téléphone, no)"
          />
          <button
            className={`admin-icon-btn${vue === "avenir" ? " active" : ""}`}
            style={vue === "avenir" ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
            onClick={() => setVue((v) => (v === "avenir" ? "jour" : "avenir"))}
          >
            {vue === "avenir" ? "← Commandes du jour" : `📅 Commandes à venir (${avenir.length})`}
          </button>
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

      {vue === "jour" ? (
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

              <div className="cmd-kiosk-col-liste">
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
                          🖨 Imprimer
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
              </div>
            </section>
          );
        })}
      </div>
      ) : (
        <div className="cmd-kiosk-avenir">
          <div className="cmd-kiosk-filtres">
            <label>
              Du <input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
            </label>
            <label>
              Au <input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
            </label>
            <button className="admin-icon-btn" onClick={() => { setDu(demain); setAu(demain); }}>
              Demain
            </button>
            <button className="admin-icon-btn" onClick={() => { setDu(demain); setAu(decalerJour(dateAujourdhui(), 7)); }}>
              7 jours
            </button>
            <button className="admin-icon-btn" onClick={() => { setDu(demain); setAu(decalerJour(dateAujourdhui(), 30)); }}>
              30 jours
            </button>
            <button className="admin-icon-btn" onClick={() => { setDu(""); setAu(""); }}>
              Tout
            </button>
            <span className="cmd-kiosk-compte">
              {avenirFiltre.length} commande{avenirFiltre.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="cmd-kiosk-avenir-liste">
            {jours.length === 0 ? (
              <p className="cmd-kiosk-vide">Aucune commande à venir{du || au || recherche ? " pour ce filtre" : ""}.</p>
            ) : (
              <table className="cmd-kiosk-table">
                <thead>
                  <tr>
                    <th>Heure</th>
                    <th>No</th>
                    <th>Client</th>
                    <th>Téléphone</th>
                    <th>Articles</th>
                    <th>Total</th>
                    <th>État</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {jours.map((g) => (
                    <Fragment key={g.jour}>
                      <tr className="cmd-kiosk-table-jour">
                        <td colSpan={8}>
                          {new Date(`${g.jour}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
                          {" · "}
                          {g.commandes.length} commande{g.commandes.length > 1 ? "s" : ""}
                        </td>
                      </tr>
                      {g.commandes.map((c) => {
                        const etat = etatCommande(c);
                        return (
                          <tr key={c.id}>
                            <td style={{ whiteSpace: "nowrap" }}>{libelleRamassage(c) || "—"}</td>
                            <td>#{c.numero || "—"}</td>
                            <td>{c.client_nom || "—"}</td>
                            <td style={{ whiteSpace: "nowrap" }}>{c.client_telephone || "—"}</td>
                            <td>
                              {(c.items || []).map((it, i) => (
                                <div key={i}>
                                  {it.quantite} × {it.nom}
                                  {it.options?.length > 0 && <span className="cmd-kiosk-options"> ({it.options.join(", ")})</span>}
                                </div>
                              ))}
                              {noteCommande(c) && <div className="cmd-kiosk-note">📝 {noteCommande(c)}</div>}
                            </td>
                            <td style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{formatMontant(c.total)}</td>
                            <td style={{ color: etat.couleur, fontWeight: 600, whiteSpace: "nowrap" }}>{etat.texte}</td>
                            <td>
                              <div className="cmd-kiosk-table-actions">
                                {etat.id === "en_attente" && (
                                  <button className="submit-btn" disabled={enCours === c.id} onClick={() => passer(c, "traitee")}>
                                    Traiter →
                                  </button>
                                )}
                                {imprimanteActive && (
                                  <button className="admin-icon-btn" onClick={() => imprimer(c)} aria-label="Imprimer le bon">
                                    🖨 Imprimer
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

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
