// Modules auxquels un assistant IA peut avoir accès, et ce qu'il peut y faire. Partagé entre le serveur (lib/iaServer.js)
// et les pages (autorisation, réglages) : aucun import de Node ici.
//
// Niveaux : "aucun" | "lecture" | "ecriture". Un module sans `peutEcrire` plafonne à « lecture ».
// Règle de fond : l'IA ne publie jamais et n'envoie aucune notification.

export const NIVEAUX = ["aucun", "lecture", "ecriture"];

export const MODULES_IA = [
  {
    id: "horaire",
    label: "Horaire & pointage",
    lecture: "tes employés (noms seulement), tes succursales, l'horaire et les heures pointées",
    ecriture: "préparer des quarts en brouillon (invisibles des employés, tu publies toi-même)",
    peutEcrire: true,
  },
  {
    id: "planning",
    label: "Planning (tâches)",
    lecture: "les tâches et les catégories de chaque journée",
    ecriture: "ajouter des tâches aux journées. Attention : elles sont visibles des employés tout de suite (il n'y a pas de brouillon dans Planning)",
    peutEcrire: true,
  },
  {
    id: "inventaire",
    label: "Inventaire",
    lecture: "les produits et leurs quantités en stock",
    peutEcrire: false,
  },
  {
    id: "ventes",
    label: "Suivi des ventes",
    lecture: "les ventes par période et par source",
    peutEcrire: false,
  },
];

export const DROITS_PAR_DEFAUT = { horaire: "lecture", planning: "lecture", inventaire: "aucun", ventes: "aucun" };

export function normaliserDroits(d) {
  const sortie = {};
  for (const m of MODULES_IA) {
    let n = d && typeof d === "object" ? d[m.id] : undefined;
    if (!NIVEAUX.includes(n)) n = "aucun";
    if (n === "ecriture" && !m.peutEcrire) n = "lecture";
    sortie[m.id] = n;
  }
  return sortie;
}

// Droits effectifs d'une connexion. Avant les droits par module, une connexion lisait l'horaire (et le modifiait si `ecriture`).
export function droitsDe(cle) {
  if (cle && cle.droits && typeof cle.droits === "object") return normaliserDroits(cle.droits);
  return normaliserDroits({ horaire: cle?.ecriture ? "ecriture" : "lecture" });
}

export function aAuMoinsUnDroit(droits) {
  return Object.values(droits).some((n) => n !== "aucun");
}

// Pour l'affichage : [{ id, label, niveau }] seulement pour les modules accessibles.
export function resumeDroits(droits) {
  return MODULES_IA.filter((m) => droits[m.id] && droits[m.id] !== "aucun").map((m) => ({ id: m.id, label: m.label, niveau: droits[m.id] }));
}
