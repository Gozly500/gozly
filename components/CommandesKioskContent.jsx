"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import CommandeEmployeModal from "@/components/moi/CommandeEmployeModal";
import { SaisieGozly, ChampGozly } from "@/components/saisie/SaisieGozly";
import { useAnimationCartes } from "@/lib/useAnimationCartes";
import { LangueProvider, useLangue } from "@/components/moi/LangueContext";
import { chargerProduitsInventaire, chargerCategoriesInventaire, creerCommandeManuelle, modifierCommandeManuelle, retirerCommandeManuelle } from "@/lib/commandesNouvelle";
import { synchroniserCommandes, changerEtapeCommande, imprimerCommande, impressionActive } from "@/lib/commandesClient";
import { imprimerBonsLocaux, pontImprimante } from "@/lib/impressionLocale";
import ImprimanteBluetooth from "@/components/ImprimanteBluetooth";
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
import { IconCalendrier, IconCloche, IconClocheBarree, IconCrochet, IconDocument, IconFlecheDroite, IconFlecheGauche, IconImprimante } from "@/components/icons/Pictogrammes";

const INTERVALLE_SYNC_MS = 30000;

// Les titres et libellés de boutons viennent du dictionnaire (kq.c.col.<id>, kq.c.traiter / kq.c.terminer).
const COLONNES = [
  { id: "en_attente", suivante: "traitee", couleur: "#ffd479" },
  { id: "traitee", suivante: "terminee", couleur: "#8ab4ff" },
  { id: "terminee", suivante: null, couleur: "#7ee2a8" },
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

// Bouton rond « ⋯ » à droite du bouton Terminer : un toucher le déplie en pastille avec Modifier / Retirer (un toucher ailleurs le replie).
export function MenuCommande({ onModifier, onRetirer, t }) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e) => {
      if (racine.current && !racine.current.contains(e.target)) setOuvert(false);
    };
    document.addEventListener("pointerdown", dehors);
    return () => document.removeEventListener("pointerdown", dehors);
  }, [ouvert]);
  return (
    <div className="cmd-menu-place" ref={racine}>
      <div className={`cmd-menu${ouvert ? " ouvert" : ""}`}>
        <button type="button" className="cmd-menu-option" tabIndex={ouvert ? 0 : -1} onClick={() => { setOuvert(false); onModifier(); }}>
          {t("kq.c.modifier")}
        </button>
        <button type="button" className="cmd-menu-option danger" tabIndex={ouvert ? 0 : -1} onClick={() => { setOuvert(false); onRetirer(); }}>
          {t("kq.c.retirer")}
        </button>
        <button type="button" className="cmd-menu-points" aria-expanded={ouvert} aria-label={t("kq.c.plus")} onClick={() => setOuvert((o) => !o)}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2.2" />
            <circle cx="12" cy="12" r="2.2" />
            <circle cx="19" cy="12" r="2.2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Essaie de lever le verrou du navigateur sur le son (il faut un toucher de l'utilisateur, sauf sur une application installée) : on lance
// le son à volume nul puis on l'arrête tout de suite. Retourne true si le navigateur l'a accepté.
let lecteurSon = null;
function obtenirLecteurSon() {
  if (!lecteurSon) lecteurSon = new Audio(SON_NOUVELLE_COMMANDE);
  return lecteurSon;
}
async function deverrouillerSon() {
  const lecteur = obtenirLecteurSon();
  try {
    lecteur.volume = 0;
    await lecteur.play();
    lecteur.pause();
    lecteur.currentTime = 0;
    lecteur.volume = 1;
    return true;
  } catch {
    lecteur.volume = 1;
    return false;
  }
}

const SON_NOUVELLE_COMMANDE = "/sons/nouvelle-commande.mp3";
const PAUSE_ENTRE_SONS_MS = 5000;

export default function CommandesKioskContent() {
  const router = useRouter();
  const { t, langue } = useLangue();
  const locale = langue === "en" ? "en-CA" : "fr-CA";
  const [checking, setChecking] = useState(true);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [entrepriseNom, setEntrepriseNom] = useState("");
  const [commandes, setCommandes] = useState([]);
  const [modal, setModal] = useState(false);
  const [aModifier, setAModifier] = useState(null); // commande saisie à la main en cours de modification
  const [aRetirer, setARetirer] = useState(null); // commande à retirer (confirmation)
  const anim = useAnimationCartes(commandes); // les cartes se décalent et la nouvelle grandit
  const dejaCharge = useRef(false); // le premier chargement n'est pas animé
  const [enCours, setEnCours] = useState(null);
  const [imprimanteActive, setImprimanteActive] = useState(false);
  // App Android du kiosque : la tablette peut imprimer elle-même par Bluetooth (le pont n'existe pas dans un navigateur ordinaire).
  const [pontBluetooth, setPontBluetooth] = useState(false);
  const [reglageBluetooth, setReglageBluetooth] = useState(false);
  useEffect(() => setPontBluetooth(!!pontImprimante()), []);
  const [message, setMessage] = useState(null);
  const [sonActif, setSonActif] = useState(false); // le son est voulu (mémorisé sur cet appareil)
  const [sonVerrouille, setSonVerrouille] = useState(false); // voulu, mais le navigateur attend un toucher pour l'autoriser (après un rechargement)
  const son = sonActif && !sonVerrouille; // le son peut vraiment jouer
  const [vue, setVue] = useState("jour"); // "jour" | "avenir" (mode liste seulement)
  // Affichage choisi dans Personnalisation : "liste" (cartes, commandes du jour) ou "sections" (En attente / Traitées / Terminées).
  const [modeKiosque, setModeKiosque] = useState("liste");
  // Son des nouvelles commandes en ligne choisi dans Personnalisation : "une_fois" | "continu" (null = selon l'affichage, comme avant).
  const [sonMode, setSonMode] = useState(null);
  const [pret, setPret] = useState(false); // premier chargement terminé (pas de son pour les commandes déjà là)
  const [aConfirmer, setAConfirmer] = useState(() => new Set()); // liste + son continu : commandes en ligne pas encore vues
  const [masquees, setMasquees] = useState(() => new Set()); // commandes terminées « vidées » de l'écran (mode sections)
  const [recherche, setRecherche] = useState("");
  const [rechercheOuverte, setRechercheOuverte] = useState(false); // tablette : fenêtre de recherche avec le clavier Gozly
  const [tablette, setTablette] = useState(false);
  useEffect(() => {
    setTablette(window.matchMedia("(pointer: coarse)").matches || new URLSearchParams(window.location.search).get("saisie") === "gozly");
  }, []);
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
        const { data } = await supabase.from("entreprises").select("nom").eq("id", eid).maybeSingle();
        if (!ignore) setEntrepriseNom(data?.nom || "");
        // Colonne ajoutée par commandes_kiosque_mode.sql : tant qu'elle n'existe pas, mode liste.
        const { data: reglage, error: erreurReglage } = await supabase.from("entreprises").select("commandes_kiosque_mode").eq("id", eid).maybeSingle();
        if (!ignore && !erreurReglage && reglage?.commandes_kiosque_mode === "sections") setModeKiosque("sections");
        // Colonne ajoutée par commandes_son_mode.sql : tant qu'elle n'existe pas, le son suit l'affichage (continu en 3 sections, une fois en liste).
        const { data: son, error: erreurSon } = await supabase.from("entreprises").select("commandes_son_mode").eq("id", eid).maybeSingle();
        if (!ignore && !erreurSon && son?.commandes_son_mode) setSonMode(son.commandes_son_mode === "continu" ? "continu" : "une_fois");
        // Le son reste voulu d'une fois à l'autre (rechargement, retour au kiosque, tablette qui se rallume) : mémorisé sur cet appareil.
        // Le navigateur exige un toucher pour jouer un son : on essaie tout de suite, sinon le premier toucher sur l'écran le réactive.
        try {
          if (window.localStorage.getItem(`gozly_cmd_son_${eid}`) === "1" && !ignore) {
            setSonActif(true);
            setSonVerrouille(true);
            deverrouillerSon().then((ok) => {
              if (ok && !ignore) setSonVerrouille(false);
            });
          }
        } catch {}
        try {
          const ids = JSON.parse(window.localStorage.getItem(`gozly_cmd_masquees_${eid}`) || "[]");
          if (!ignore && Array.isArray(ids)) setMasquees(new Set(ids));
        } catch {}
        // Seulement une fois le mode connu : sinon un premier chargement en mode liste pourrait écraser les données du mode 3 sections.
        if (!ignore) setEntrepriseId(eid);
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
    let requete = supabase
      .from("commandes_en_ligne")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .neq("canal", "POS"); // les ventes du point de vente ne passent pas par la cuisine
    if (modeKiosque === "sections") {
      // 3 sections : toutes les commandes récentes ou à venir, peu importe leur date (elles arrivent
      // dans « En attente »). Les 14 derniers jours suffisent pour ne pas traîner tout l'historique.
      const depuis14 = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      requete = requete
        .or(`date_ramassage.gte.${depuis14},and(date_ramassage.is.null,date_commande.gte.${depuis14})`)
        .limit(400);
    } else {
      // Liste : aujourd'hui et avant seulement (les précommandes sont dans « Commandes à venir »).
      const finAujourdhui = bornesJour(dateAujourdhui()).fin;
      requete = requete.or(
        `and(date_ramassage.gte.${depuis},date_ramassage.lt.${finAujourdhui}),and(date_ramassage.is.null,date_commande.gte.${depuis})`
      );
    }
    const { data } = await requete;

    // Ordre chronologique du ramassage (ou de la commande sans ramassage).
    const liste = (data || []).sort((a, b) => new Date(dateEffective(a)) - new Date(dateEffective(b)));
    if (dejaCharge.current) anim.preparer();
    dejaCharge.current = true;
    setCommandes(liste);
  }, [entrepriseId, modeKiosque]);

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
  }, [entrepriseId, modeKiosque]);

  useEffect(() => {
    if (!entrepriseId) return;
    let actif = true;
    async function cycle() {
      await synchroniserCommandes(entrepriseId); // muet si Wix n'est pas connecté
      // Tablette avec imprimante Bluetooth : les bons que la synchro vient de mettre en file sortent tout de suite.
      imprimerBonsLocaux(entrepriseId).then(({ erreur }) => {
        if (erreur && actif) {
          setMessage({ type: "err", text: t("kq.imp.erreur", { erreur }) });
          setTimeout(() => setMessage(null), 8000);
        }
      });
      if (actif) {
        await charger();
        await chargerAvenir();
      }
    }
    Promise.all([charger(), chargerAvenir()]).then(() => {
      if (actif) setPret(true);
    });
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

  const nbEnAttente = modeKiosque === "sections" ? commandes.filter((c) => etapeCommande(c) === "en_attente").length : 0;
  const sonContinu = (sonMode ?? (modeKiosque === "sections" ? "continu" : "une_fois")) === "continu";
  // Liste + son continu : les commandes en ligne arrivées et pas encore vues (retirées d'ici dès qu'elles sont terminées ou annulées).
  const nbAConfirmer =
    modeKiosque === "liste" && sonContinu
      ? [...commandes, ...avenir].filter((c) => aConfirmer.has(c.id) && etapeCommande(c) !== "terminee" && etapeCommande(c) !== "annulee").length
      : 0;
  const boucleSon = sonContinu && (modeKiosque === "sections" ? nbEnAttente > 0 : nbAConfirmer > 0);

  // Son en boucle tant qu'une commande attend : on le joue, et 5 secondes
  // après la fin on le rejoue, jusqu'à ce que plus rien ne soit "En attente" (3 sections) ou à confirmer (liste), en mode continu.
  // (Un navigateur n'autorise le son qu'après un toucher : bouton "Activer le son".)
  useEffect(() => {
    if (!son || !boucleSon) return;
    if (!audioRef.current) audioRef.current = obtenirLecteurSon();
    const audio = audioRef.current;
    let minuteur;
    let actif = true;

    function jouer() {
      if (!actif) return;
      audio.currentTime = 0;
      audio.play().catch(() => setSonVerrouille(true)); // refusé (page rechargée, tablette rallumée) : le prochain toucher réactive
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
  }, [son, boucleSon]);

  // Nouvelle commande en ligne (jour ou à venir), peu importe l'affichage :
  //  - son « une seule fois » : on le joue une fois ;
  //  - son « continu » : 3 sections, la boucle ci-dessus repart toute seule (la commande arrive « En attente ») ;
  //    liste, la commande est notée « à confirmer » et la boucle dure jusqu'à ce qu'on la touche ou qu'on arrête le son.
  const dejaVuesRef = useRef(null);
  useEffect(() => {
    if (!pret) return;
    const toutes = [...commandes, ...avenir];
    const ids = new Set(toutes.map((c) => c.id));
    if (dejaVuesRef.current === null) {
      dejaVuesRef.current = ids; // premier chargement : pas de son
      return;
    }
    const nouvelles = toutes.filter((c) => !dejaVuesRef.current.has(c.id) && c.source !== "manuel");
    dejaVuesRef.current = ids;
    if (nouvelles.length === 0) return;
    if (sonContinu) {
      if (modeKiosque === "liste") setAConfirmer((prev) => new Set([...prev, ...nouvelles.map((c) => c.id)]));
      return;
    }
    if (son) {
      if (!audioRef.current) audioRef.current = obtenirLecteurSon();
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setSonVerrouille(true));
    }
  }, [commandes, avenir, pret, modeKiosque, son, sonContinu]);

  // Son voulu mais verrouillé par le navigateur : le premier toucher n'importe où sur l'écran le réactive (sans bruit).
  useEffect(() => {
    if (!sonActif || !sonVerrouille) return;
    const reactiver = () => {
      deverrouillerSon().then((ok) => {
        if (ok) setSonVerrouille(false);
      });
    };
    window.addEventListener("pointerdown", reactiver, { once: true });
    return () => window.removeEventListener("pointerdown", reactiver);
  }, [sonActif, sonVerrouille]);

  // Tant que le son est voulu, l'écran reste allumé : une tablette qui s'endort ne peut plus jouer le son ni recevoir les commandes.
  useEffect(() => {
    if (!sonActif || !navigator.wakeLock) return;
    let verrou = null;
    let arrete = false;
    async function demander() {
      try {
        verrou = await navigator.wakeLock.request("screen");
      } catch {}
    }
    const auRetour = () => {
      if (document.visibilityState === "visible" && !arrete) demander();
    };
    demander();
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      arrete = true;
      document.removeEventListener("visibilitychange", auRetour);
      verrou?.release?.().catch(() => {});
    };
  }, [sonActif]);

  // Liste + son continu : toucher une commande, ou « Arrêter le son », la marque comme vue.
  function confirmerVue(id) {
    setAConfirmer((prev) => {
      if (!prev.has(id)) return prev;
      const suivant = new Set(prev);
      suivant.delete(id);
      return suivant;
    });
  }

  // Activer le son : on joue le son tout de suite, PENDANT le toucher. Sur iPad/iPhone, un son doit d'abord être lancé
  // par un geste de l'utilisateur sur ce même lecteur audio, sinon les sons joués plus tard (nouvelle commande) sont
  // refusés. Ça sert aussi de confirmation : on entend que le son fonctionne.
  function basculerSon() {
    // Voulu mais verrouillé : le toucher sur le bouton suffit à réactiver (et on entend le son, comme confirmation).
    if (sonActif && sonVerrouille) {
      if (!audioRef.current) audioRef.current = obtenirLecteurSon();
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setSonVerrouille(false)).catch(() => {});
      return;
    }
    if (!sonActif) {
      if (!audioRef.current) audioRef.current = obtenirLecteurSon();
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setSonVerrouille(false);
    }
    const suivant = !sonActif;
    setSonActif(suivant);
    try {
      if (suivant) window.localStorage.setItem(`gozly_cmd_son_${entrepriseId}`, "1");
      else window.localStorage.removeItem(`gozly_cmd_son_${entrepriseId}`);
    } catch {}
  }

  async function imprimer(commande) {
    const { ok, error } = await imprimerCommande(entrepriseId, commande.id, "manuel");
    setMessage(
      ok
        ? { type: "ok", text: t("kq.c.bonEnvoye", { n: commande.numero }) }
        : { type: "err", text: error || t("kq.c.impressionEchec") }
    );
    setTimeout(() => setMessage(null), 4000);
  }

  // Mode 3 sections : « Vider » cache les commandes terminées affichées (mémorisé sur cet appareil).
  function viderTerminees(liste) {
    const suivant = new Set(masquees);
    for (const c of liste) suivant.add(c.id);
    setMasquees(suivant);
    try {
      window.localStorage.setItem(`gozly_cmd_masquees_${entrepriseId}`, JSON.stringify([...suivant].slice(-400)));
    } catch {}
  }

  async function retirer(commande) {
    setEnCours(commande.id);
    setARetirer(null);
    // La carte se désagrège pendant que la suppression se fait ; les autres cartes glissent ensuite pour combler la place.
    const effet = anim.desagreger(commande.id);
    const [{ ok, error }] = await Promise.all([retirerCommandeManuelle(entrepriseId, commande.id), effet ? new Promise((r) => setTimeout(r, 650)) : null]);
    if (!ok) {
      effet?.annuler();
      setMessage({ type: "err", text: error });
      setTimeout(() => setMessage(null), 6000);
    } else {
      anim.preparer();
      setCommandes((prev) => prev.filter((c) => c.id !== commande.id));
      setAvenir((prev) => prev.filter((c) => c.id !== commande.id));
    }
    await charger();
    await chargerAvenir();
    setEnCours(null);
  }

  // Boutons Modifier / Retirer : seulement pour les commandes saisies à la main (celles du site se règlent chez Wix).
  const boutonsManuelle = (c) =>
    c.source === "manuel" && (
      <>
        <button className="admin-icon-btn" onClick={() => setAModifier(c)}>
          {t("kq.c.modifier")}
        </button>
        <button className="admin-icon-btn danger" onClick={() => setARetirer(c)}>
          {t("kq.c.retirer")}
        </button>
      </>
    );

  const menuManuelle = (c) => c.source === "manuel" && <MenuCommande t={t} onModifier={() => setAModifier(c)} onRetirer={() => setARetirer(c)} />;

  async function passer(commande, etape) {
    setEnCours(commande.id);
    // Mise à jour immédiate à l'écran, puis confirmation du serveur.
    anim.preparer();
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
        <p style={{ color: "var(--text-dim)" }}>{t("kq.chargement")}</p>
      </div>
    );
  }

  if (!entrepriseId) {
    return (
      <div className="kiosk-screen">
        <p style={{ color: "var(--text-dim)" }}>{t("kq.aucuneEntreprise")}</p>
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
  const debutHier = bornesJour(decalerJour(dateAujourdhui(), -1)).debut;

  // Terminées affichées : mode liste = celles d'aujourd'hui ; 3 sections = celles d'hier et d'aujourd'hui,
  // sauf celles « vidées » (le nettoyage : les plus anciennes disparaissent toutes seules).
  const terminesAffichees = (c) =>
    etapeCommande(c) === "terminee" &&
    (modeKiosque === "sections"
      ? new Date(dateEffective(c)) >= new Date(debutHier) && !masquees.has(c.id)
      : new Date(dateEffective(c)) >= new Date(debutAujourdhui));

  // Mode liste : toutes les commandes du jour dans une seule liste. Les commandes à faire d'abord (par heure de
  // ramassage), puis les terminées. Pas d'étape « En attente » : une commande à faire est une commande « Traitée ».
  const parHeure = (x, y) => new Date(dateEffective(x)) - new Date(dateEffective(y));
  const aFaireListe = visibles.filter((c) => etapeCommande(c) !== "terminee").sort(parHeure);
  const terminesListe = visibles.filter(terminesAffichees).sort(parHeure);
  const aAfficherListe = [...aFaireListe, ...terminesListe];

  function renderCarte(c, col, liste = false) {
    const modeTexte = libelleMode(c.mode) ? t(`kq.c.mode.${c.mode}`) : null;
    const clePaiement = c.statut_paiement === "PARTIALLY_REFUNDED" ? "REFUNDED" : c.statut_paiement;
    const paiement = libellePaiement(c) ? t(`kq.c.pay.${clePaiement}`) : null;
    const etat = etatCommande(c);
    return (
      <article className={`cmd-kiosk-card${liste && etapeCommande(c) === "terminee" ? " cmd-kiosk-card-finie" : ""}`} key={c.id} ref={anim.ref(c.id)} onClick={() => aConfirmer.size > 0 && confirmerVue(c.id)}>
        <div className="cmd-kiosk-card-top">
          <strong>#{c.numero || "—"}</strong>
          <span>{libelleRamassage(c, locale) ? t("kq.c.ramassageHeure", { h: libelleRamassage(c, locale) }) : heureCommande(c.date_commande, locale)}</span>
        </div>
        {c.client_nom && <div className="cmd-kiosk-client">{c.client_nom}</div>}
        {noteCommande(c) && <div className="cmd-kiosk-note"><IconDocument className="gozly-icon" /> {noteCommande(c)}</div>}
        <div className="cmd-kiosk-tags">
          {liste && etapeCommande(c) === "terminee" && (
            <span className="cmd-kiosk-tag" style={{ color: etat.couleur, fontWeight: 700 }}>
              <IconCrochet className="gozly-icon" /> {t("kq.c.terminee")}
            </span>
          )}
          {modeTexte && <span className="cmd-kiosk-tag">{modeTexte}</span>}
          {c.lieu_nom && <span className="cmd-kiosk-tag">{c.lieu_nom}</span>}
          {paiement && <span className="cmd-kiosk-tag">{paiement}</span>}
          {c.source === "manuel" && <span className="cmd-kiosk-tag">{t("kq.c.manuelle")}</span>}
          {c.date_ramassage && jourQuebec(c.date_ramassage) !== dateAujourdhui() && (
            <span className="cmd-kiosk-tag">
              {new Date(`${jourQuebec(c.date_ramassage)}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
            </span>
          )}
        </div>
        <div className="cmd-kiosk-items">
          {(c.items || []).map((it, i) => (
            <div key={i}>
              <strong>{it.quantite} ×</strong> {it.nom}
              {it.options?.length > 0 && <div className="cmd-kiosk-options">{it.options.join(", ")}</div>}
            </div>
          ))}
        </div>
        <div className="cmd-kiosk-total">{formatMontant(c.total, locale)}</div>

        <div className="cmd-kiosk-actions">
          {imprimanteActive && (
            <button className="admin-icon-btn" onClick={() => imprimer(c)} aria-label={t("kq.c.imprimerBon")}>
              <IconImprimante className="gozly-icon" /> {t("kq.c.imprimer")}
            </button>
          )}
          {liste ? (
            etapeCommande(c) !== "terminee" && (
              <button className="submit-btn" disabled={enCours === c.id} onClick={() => passer(c, "terminee")}>
                {t("kq.c.terminer")} <IconCrochet className="gozly-icon" />
              </button>
            )
          ) : (
            <>
              {col.id !== "en_attente" && (
                <button className="admin-icon-btn" disabled={enCours === c.id} onClick={() => passer(c, col.id === "terminee" ? "traitee" : "en_attente")}>
                  <IconFlecheGauche className="gozly-icon" /> {t("kq.c.retour")}
                </button>
              )}
              {col.suivante && (
                <button className="submit-btn" disabled={enCours === c.id} onClick={() => passer(c, col.suivante)}>
                  {col.suivante === "traitee" ? (
                    <>{t("kq.c.traiter")} <IconFlecheDroite className="gozly-icon-inline" /></>
                  ) : (
                    <>{t("kq.c.terminer")} <IconCrochet className="gozly-icon" /></>
                  )}
                </button>
              )}
            </>
          )}
          {menuManuelle(c)}
        </div>
      </article>
    );
  }

  // Tableau des commandes à venir (les deux modes). En mode 3 sections, les vraies étapes et le bouton « Traiter » sont gardés.
  const vueAvenir = (
        <div className="cmd-kiosk-avenir">
          <div className="cmd-kiosk-filtres">
            <label>
              {t("kq.c.du")} <input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
            </label>
            <label>
              {t("kq.c.au")} <input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
            </label>
            <button className="admin-icon-btn" onClick={() => { setDu(demain); setAu(demain); }}>
              {t("kq.c.demain")}
            </button>
            <button className="admin-icon-btn" onClick={() => { setDu(demain); setAu(decalerJour(dateAujourdhui(), 7)); }}>
              {t("kq.c.sept")}
            </button>
            <button className="admin-icon-btn" onClick={() => { setDu(demain); setAu(decalerJour(dateAujourdhui(), 30)); }}>
              {t("kq.c.trente")}
            </button>
            <button className="admin-icon-btn" onClick={() => { setDu(""); setAu(""); }}>
              {t("kq.c.tout")}
            </button>
            <span className="cmd-kiosk-compte">
              {t(avenirFiltre.length > 1 ? "kq.c.nbN" : "kq.c.nb1", { n: avenirFiltre.length })}
            </span>
          </div>

          <div className="cmd-kiosk-avenir-liste">
            {jours.length === 0 ? (
              <p className="cmd-kiosk-vide">{t(du || au || recherche ? "kq.c.aucuneAvenirFiltre" : "kq.c.aucuneAvenir")}</p>
            ) : (
              <table className="cmd-kiosk-table">
                <thead>
                  <tr>
                    <th>{t("kq.c.th.heure")}</th>
                    <th>{t("kq.c.th.no")}</th>
                    <th>{t("kq.c.th.client")}</th>
                    <th>{t("kq.c.th.tel")}</th>
                    <th>{t("kq.c.th.articles")}</th>
                    <th>{t("kq.c.th.total")}</th>
                    <th>{t("kq.c.th.etat")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {jours.map((g) => (
                    <Fragment key={g.jour}>
                      <tr className="cmd-kiosk-table-jour">
                        <td colSpan={8}>
                          {new Date(`${g.jour}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                          {" · "}
                          {t(g.commandes.length > 1 ? "kq.c.nbN" : "kq.c.nb1", { n: g.commandes.length })}
                        </td>
                      </tr>
                      {g.commandes.map((c) => {
                        const etat = etatCommande(c);
                        // Pas d'étape « En attente » en mode liste : c'est une commande « Traitée ».
                        const etatTexte = modeKiosque === "liste" && etat.id === "en_attente" ? { id: "traitee", couleur: "#8ab4ff" } : etat;
                        return (
                          <tr key={c.id}>
                            <td style={{ whiteSpace: "nowrap" }}>{libelleRamassage(c, locale) || "—"}</td>
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
                              {noteCommande(c) && <div className="cmd-kiosk-note"><IconDocument className="gozly-icon" /> {noteCommande(c)}</div>}
                            </td>
                            <td style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{formatMontant(c.total, locale)}</td>
                            <td style={{ color: etatTexte.couleur, fontWeight: 600, whiteSpace: "nowrap" }}>{t(`kq.c.etat.${etatTexte.id}`)}</td>
                            <td>
                              <div className="cmd-kiosk-table-actions">
                                {modeKiosque === "sections" && etat.id === "en_attente" && (
                                  <button className="submit-btn" disabled={enCours === c.id} onClick={() => passer(c, "traitee")}>
                                    {t("kq.c.traiter")} <IconFlecheDroite className="gozly-icon-inline" />
                                  </button>
                                )}
                                {imprimanteActive && (
                                  <button className="admin-icon-btn" onClick={() => imprimer(c)} aria-label={t("kq.c.imprimerBon")}>
                                    <IconImprimante className="gozly-icon" /> {t("kq.c.imprimer")}
                                  </button>
                                )}
                                {boutonsManuelle(c)}
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
  );

  return (
    <div className="cmd-kiosk">
      <header className="cmd-kiosk-head">
        <div>
          <div className="kiosk-entreprise">{entrepriseNom}</div>
          <h2>{t("kq.c.titre")}</h2>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          {tablette ? (
            // Tablette : toucher la recherche ouvre une fenêtre avec le clavier de Gozly (pas celui du système).
            <input
              type="search"
              className="cmd-kiosk-recherche"
              value={recherche}
              readOnly
              inputMode="none"
              onClick={() => setRechercheOuverte(true)}
              onFocus={() => setRechercheOuverte(true)}
              placeholder={t("kq.c.rechercher")}
            />
          ) : (
            <input
              type="search"
              className="cmd-kiosk-recherche"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder={t("kq.c.rechercher")}
            />
          )}
          <button
            className={`admin-icon-btn${vue === "avenir" ? " active" : ""}`}
            style={vue === "avenir" ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
            onClick={() => setVue((v) => (v === "avenir" ? "jour" : "avenir"))}
          >
            {vue === "avenir" ? <><IconFlecheGauche className="gozly-icon" /> {t("kq.c.voirJour")}</> : <><IconCalendrier className="gozly-icon" /> {t("kq.c.voirAvenir", { n: avenir.length })}</>}
          </button>
          <button
            className="admin-icon-btn"
            onClick={basculerSon}
            style={!son ? { background: "rgba(255,212,121,0.25)", borderColor: "rgba(255,212,121,0.6)" } : undefined}
          >
            {son ? <><IconCloche className="gozly-icon" /> {t("kq.c.sonOn")}</> : sonActif ? <><IconClocheBarree className="gozly-icon" /> {t("kq.c.sonReactiver")}</> : <><IconClocheBarree className="gozly-icon" /> {t("kq.c.sonOff")}</>}
          </button>
          {pontBluetooth && (
            <button className="admin-icon-btn" onClick={() => setReglageBluetooth(true)}>
              <IconImprimante className="gozly-icon" /> {t("kq.imp.bouton")}
            </button>
          )}
          <button className="submit-btn" onClick={() => setModal(true)}>
            {t("kq.c.nouvelle")}
          </button>
        </div>
      </header>

      {reglageBluetooth && <ImprimanteBluetooth entrepriseId={entrepriseId} onClose={() => setReglageBluetooth(false)} />}

      {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}

      {sonActif && sonVerrouille && (
        <button type="button" className="cmd-kiosk-son-bloque" onClick={basculerSon}>
          <IconClocheBarree className="gozly-icon" /> {t("kq.c.sonBloque")}
        </button>
      )}

      {nbAConfirmer > 0 && (
        <div className="cmd-kiosk-alerte" role="status">
          <span>
            <IconCloche className="gozly-icon" /> {t("kq.c.nouvelleEnLigne")}
          </span>
          <button type="button" className="admin-icon-btn" onClick={() => setAConfirmer(new Set())}>
            {t("kq.c.arreterSon")}
          </button>
        </div>
      )}

      {vue === "avenir" ? (
        vueAvenir
      ) : modeKiosque === "liste" ? (
        <div className="cmd-kiosk-liste-wrap">
          <div className="cmd-kiosk-liste">
            {aAfficherListe.length === 0 ? (
              <p className="cmd-kiosk-vide">{t(recherche.trim() ? "kq.c.aucunePourRecherche" : "kq.c.aucune")}</p>
            ) : (
              aAfficherListe.map((c) => renderCarte(c, COLONNES.find((col) => col.id === etapeCommande(c)) || COLONNES[1], true))
            )}
          </div>
        </div>
      ) : (
      <div className="cmd-kiosk-cols">
        {COLONNES.map((col) => {
          const liste = visibles.filter(
            (c) => (col.id === "terminee" ? terminesAffichees(c) : etapeCommande(c) === col.id)
          );
          return (
            <section className="cmd-kiosk-col" key={col.id}>
              <div className="cmd-kiosk-col-head" style={{ borderColor: col.couleur }}>
                <span>{t(`kq.c.col.${col.id}`)}</span>
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {col.id === "terminee" && liste.length > 0 && (
                    <button className="admin-icon-btn" onClick={() => viderTerminees(liste)}>
                      {t("kq.c.vider")}
                    </button>
                  )}
                  <span className="cmd-kiosk-count">{liste.length}</span>
                </span>
              </div>

              <div className="cmd-kiosk-col-liste">
              {liste.length === 0 && <p className="cmd-kiosk-vide">{t("kq.c.aucuneCol")}</p>}

              {liste.map((c) => renderCarte(c, col))}
              </div>
            </section>
          );
        })}
      </div>
      )}

      {rechercheOuverte && (
        <div className="modal-overlay" onClick={() => setRechercheOuverte(false)}>
          <SaisieGozly actif>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>{t("kq.c.rechercher")}</h3>
                <button type="button" className="admin-icon-btn" onClick={() => setRechercheOuverte(false)}>
                  {t("kq.c.fermer")}
                </button>
              </div>
              <ChampGozly id="cmd-recherche" type="texte" label={t("kq.c.rechercher")} placeholder={t("kq.c.rechercher")} value={recherche} onChange={setRecherche} autoOuvrir style={{ width: "100%", boxSizing: "border-box", margin: 0 }} />
              {recherche && (
                <button type="button" className="admin-icon-btn" style={{ marginTop: "10px" }} onClick={() => setRecherche("")}>
                  {t("kq.c.effacerRecherche")}
                </button>
              )}
            </div>
          </SaisieGozly>
        </div>
      )}

      {aRetirer && (
        <div className="modal-overlay" onClick={() => setARetirer(null)}>
          <div className="modal-card" style={{ maxWidth: "420px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <h3>{t("kq.c.retirerTitre", { n: aRetirer.numero })}</h3>
            <p style={{ color: "var(--text-dim)" }}>{t("kq.c.retirerTexte")}</p>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button type="button" className="admin-icon-btn" style={{ flex: 1, padding: "14px" }} onClick={() => setARetirer(null)}>
                {t("kq.c.annuler")}
              </button>
              <button type="button" className="submit-btn" style={{ flex: 1, padding: "14px" }} disabled={enCours === aRetirer.id} onClick={() => retirer(aRetirer)}>
                {t("kq.c.retirer")}
              </button>
            </div>
          </div>
        </div>
      )}

      {aModifier && (
        <LangueProvider>
          <CommandeEmployeModal
            key={aModifier.id}
            commande={aModifier}
            saisieGozly={tablette}
            catalogue
            dateParDefaut={dateAujourdhui()}
            chargerProduits={() => chargerProduitsInventaire(entrepriseId)}
            chargerCategories={() => chargerCategoriesInventaire(entrepriseId)}
            enregistrer={(c) => modifierCommandeManuelle(entrepriseId, aModifier.id, c)}
            onClose={() => setAModifier(null)}
            onSaved={() => {
              setAModifier(null);
              charger();
              chargerAvenir();
            }}
          />
        </LangueProvider>
      )}

      {modal && (
        <LangueProvider>
          <CommandeEmployeModal
            // Tablette (écran tactile) : le clavier, le calendrier et le choix d'heure de Gozly. ?saisie=gozly pour l'essayer sur un ordinateur.
            catalogue
            saisieGozly={window.matchMedia("(pointer: coarse)").matches || new URLSearchParams(window.location.search).get("saisie") === "gozly"}
            dateParDefaut={dateAujourdhui()}
            chargerProduits={() => chargerProduitsInventaire(entrepriseId)}
            chargerCategories={() => chargerCategoriesInventaire(entrepriseId)}
            enregistrer={(c) => creerCommandeManuelle(entrepriseId, c)}
            onClose={() => setModal(false)}
            onSaved={() => {
              setModal(false);
              charger();
              chargerAvenir();
            }}
          />
        </LangueProvider>
      )}
    </div>
  );
}
