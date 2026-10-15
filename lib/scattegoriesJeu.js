// Règles de pointage de Scattegories (multijoueur) : calcul côté hôte uniquement.

export function normaliser(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

// Une réponse est valide si elle n'est pas vide et commence par la lettre de la manche.
export function reponseValide(texte, lettre) {
  const n = normaliser(texte);
  return n.length > 0 && n.startsWith(normaliser(lettre));
}

// joueurs : [{ id, nom, reponses: string[] }] ; retourne, pour chaque joueur, les cellules et les points.
// Règle classique : une réponse valide que personne d'autre n'a donnée rapporte 1 point ; une même
// réponse donnée par plusieurs joueurs (doublon) ou une réponse invalide rapporte 0.
// corrections : { "idJoueur:indexCategorie": true|false } = décision manuelle de l'hôte (1 pt / 0 pt).
export function calculerManche(joueurs, categories, lettre, corrections = {}) {
  const compte = categories.map(() => new Map());
  for (const j of joueurs) {
    categories.forEach((_, i) => {
      const texte = j.reponses?.[i] || "";
      if (!reponseValide(texte, lettre)) return;
      const n = normaliser(texte);
      compte[i].set(n, (compte[i].get(n) || 0) + 1);
    });
  }
  return joueurs.map((j) => {
    const cellules = categories.map((_, i) => {
      const texte = (j.reponses?.[i] || "").trim();
      const valide = reponseValide(texte, lettre);
      const doublon = valide && (compte[i].get(normaliser(texte)) || 0) > 1;
      const auto = valide && !doublon;
      const force = corrections[`${j.id}:${i}`];
      const ok = typeof force === "boolean" ? force : auto;
      return { texte, valide, doublon, ok, corrige: typeof force === "boolean" };
    });
    return { id: j.id, nom: j.nom, cellules, points: cellules.filter((c) => c.ok).length };
  });
}
