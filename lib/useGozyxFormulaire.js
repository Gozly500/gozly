"use client";

import { useState } from "react";

// Fait réagir Gozyx aux champs d'un formulaire (inscription, connexion) :
//  - champ courriel / nom : il regarde vers le champ, et ses pupilles suivent le texte qu'on tape (de gauche à droite) ;
//  - champ mot de passe : il ferme les yeux (il ne regarde pas !) ;
//  - ailleurs : il redevient normal.
// Utilisation : const g = useGozyxFormulaire(); <form {...g.handlers}> ... <Gozyx humeur={g.humeur} regard={g.regard} />
const NORMAL = { humeur: "normal", regard: { x: 0, y: 0 } };

function etatPour(el) {
  if (!el || el.tagName !== "INPUT") return NORMAL;
  if (el.type === "password") return { humeur: "ferme", regard: { x: 0, y: 0 } };
  if (el.type === "email" || el.type === "text") {
    const progres = Math.min((el.value || "").length, 28) / 28; // 0 = début du champ, 1 = fin
    return { humeur: "regarde", regard: { x: -26 + 52 * progres, y: 56 } };
  }
  return NORMAL;
}

export function useGozyxFormulaire() {
  const [etat, setEtat] = useState(NORMAL);
  const [reussi, setReussi] = useState(false);
  // Après un succès (compte créé, connexion réussie), Gozyx saute de joie et ignore les champs.
  const maj = (suivant) => !reussi && setEtat(suivant);
  return {
    humeur: reussi ? "content" : etat.humeur,
    regard: reussi ? NORMAL.regard : etat.regard,
    succes: () => setReussi(true),
    handlers: {
      onFocus: (e) => maj(etatPour(e.target)),
      onInput: (e) => maj(etatPour(e.target)),
      onBlur: () => maj(NORMAL),
    },
  };
}
