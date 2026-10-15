"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { genererCode, genererId, ouvrirSalle } from "@/lib/scategoriesRoom";
import { calculerManche } from "@/lib/scategoriesJeu";

const DELAI_COLLECTE_MS = 4500;

// Côté hôte d'une partie multijoueur. Tout reste en mémoire (aucune base de données) :
// - joueurs : liste de présence ; reponses : dernières réponses reçues de chacun ;
// - historique : résultats de chaque manche (pour le classement cumulé).
// snapshotRef : { phase, lettre, categories, restant, manche, duree } mis à jour par le composant.
export function useSalleHote(snapshotRef) {
  const [code, setCode] = useState(null);
  const [statut, setStatut] = useState("idle"); // idle | connexion | ok | erreur
  const [joueurs, setJoueurs] = useState([]);
  const [resultat, setResultat] = useState(null); // { manche, lettre, categories, lignes }
  const [historique, setHistorique] = useState({}); // manche -> lignes (avec corrections appliquées)
  const resultatRef = useRef(null);
  const historiqueRef = useRef({});
  const salleRef = useRef(null);
  const idRef = useRef(genererId());
  const reponsesRef = useRef({}); // id -> { nom, manche, reponses }
  const joueursRef = useRef([]);
  const correctionsRef = useRef({}); // manche -> { "id:i": bool }
  const battementRef = useRef(null);
  const collecteRef = useRef(null);

  const envoyer = useCallback((msg) => {
    try {
      salleRef.current?.envoyer(msg);
    } catch {}
  }, []);

  const diffuser = useCallback(() => {
    if (!salleRef.current) return;
    envoyer({ t: "etat", hote: idRef.current, nbJoueurs: joueursRef.current.length, ...snapshotRef.current });
  }, [envoyer, snapshotRef]);

  const nettoyer = useCallback(() => {
    clearInterval(battementRef.current);
    clearTimeout(collecteRef.current);
    try {
      salleRef.current?.quitter();
    } catch {}
    salleRef.current = null;
    reponsesRef.current = {};
    correctionsRef.current = {};
    joueursRef.current = [];
    setCode(null);
    setJoueurs([]);
    resultatRef.current = null;
    historiqueRef.current = {};
    setResultat(null);
    setHistorique({});
    setStatut("idle");
  }, []);

  const creer = useCallback(async () => {
    if (salleRef.current) return;
    const c = genererCode();
    setStatut("connexion");
    setCode(c);
    try {
      const salle = await ouvrirSalle(c, { id: idRef.current, nom: "Hôte", role: "hote" });
      salleRef.current = salle;
      salle.surMessage((m) => {
        if (m.t === "rep" && m.id) reponsesRef.current[m.id] = { nom: m.nom, manche: m.manche, reponses: m.reponses };
      });
      salle.surPresence((liste) => {
        const js = liste
          .filter((p) => p.role === "joueur")
          .sort((a, b) => (a.ts || 0) - (b.ts || 0))
          .map((p) => ({ id: p.id, nom: p.nom }));
        const change = js.length !== joueursRef.current.length || js.some((j, i) => j.id !== joueursRef.current[i]?.id);
        joueursRef.current = js;
        if (change) {
          setJoueurs(js);
          diffuser();
        }
      });
      setStatut("ok");
      battementRef.current = setInterval(diffuser, 3000);
      diffuser();
    } catch {
      setStatut("erreur");
      salleRef.current = null;
    }
  }, [diffuser]);

  const quitter = useCallback(() => {
    envoyer({ t: "fin" });
    nettoyer();
  }, [envoyer, nettoyer]);

  // Classement cumulé à partir de l'historique.
  const classementDe = useCallback((hist) => {
    const totaux = new Map();
    for (const lignes of Object.values(hist)) {
      for (const l of lignes) {
        const t = totaux.get(l.id) || { id: l.id, nom: l.nom, total: 0 };
        t.total += l.points;
        t.nom = l.nom;
        totaux.set(l.id, t);
      }
    }
    return [...totaux.values()].sort((a, b) => b.total - a.total);
  }, []);

  const publier = useCallback(
    (res, hist) => {
      envoyer({ t: "resultats", ...res, classement: classementDe(hist) });
    },
    [envoyer, classementDe]
  );

  // Fin du temps : on laisse un court délai aux téléphones pour envoyer leurs dernières réponses.
  const lancerCollecte = useCallback(
    (manche, lettre, categories) => {
      clearTimeout(collecteRef.current);
      collecteRef.current = setTimeout(() => {
        const participants = joueursRef.current.map((j) => {
          const r = reponsesRef.current[j.id];
          return { id: j.id, nom: j.nom, reponses: r && r.manche === manche ? r.reponses : [] };
        });
        const lignes = calculerManche(participants, categories, lettre, correctionsRef.current[manche] || {});
        const res = { manche, lettre, categories, lignes };
        resultatRef.current = res;
        historiqueRef.current = { ...historiqueRef.current, [manche]: lignes };
        setResultat(res);
        setHistorique(historiqueRef.current);
        publier(res, historiqueRef.current);
      }, DELAI_COLLECTE_MS);
    },
    [publier]
  );

  // Décision manuelle de l'hôte sur une réponse (1 pt / 0 pt).
  const corriger = useCallback(
    (idJoueur, index) => {
      const res = resultatRef.current;
      if (!res) return;
      const courant = res.lignes.find((l) => l.id === idJoueur)?.cellules[index];
      if (!courant) return;
      const manche = res.manche;
      correctionsRef.current[manche] = { ...(correctionsRef.current[manche] || {}), [`${idJoueur}:${index}`]: !courant.ok };
      const participants = res.lignes.map((l) => ({ id: l.id, nom: l.nom, reponses: l.cellules.map((c) => c.texte) }));
      const lignes = calculerManche(participants, res.categories, res.lettre, correctionsRef.current[manche]);
      const nouveau = { ...res, lignes };
      resultatRef.current = nouveau;
      historiqueRef.current = { ...historiqueRef.current, [manche]: lignes };
      setResultat(nouveau);
      setHistorique(historiqueRef.current);
      publier(nouveau, historiqueRef.current);
    },
    [publier]
  );

  // Nouvelle manche : on vide les réponses reçues et le résultat affiché.
  const nouvelleManche = useCallback(() => {
    clearTimeout(collecteRef.current);
    reponsesRef.current = {};
    resultatRef.current = null;
    setResultat(null);
  }, []);

  useEffect(() => () => nettoyer(), [nettoyer]);

  return {
    code,
    statut,
    joueurs,
    resultat,
    classement: classementDe(historique),
    actif: !!code,
    creer,
    quitter,
    diffuser,
    lancerCollecte,
    corriger,
    nouvelleManche,
  };
}
