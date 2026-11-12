import { MODULES_IA } from "@/lib/iaModules";

export const ETIQUETTES_STATUT = {
  brouillon: "Brouillon",
  soumise: "En révision",
  approuvee: "Approuvée",
  refusee: "Refusée",
};

// Permissions qu'une app peut demander : « module:action », reprises des modules déjà exposés aux assistants IA.
export const PERMISSIONS_APP = MODULES_IA.map((m) => ({
  module: m.id,
  label: m.label,
  actions: m.actions.map((a) => ({ id: `${m.id}:${a.id}`, label: a.label })),
}));

// Règles de la page de gestion d'une app (affichée dans Gozly). Vérifiées à la main avant l'approbation.
export const REGLES_PAGE = [
  "Design neutre : fond transparent, aucune bannière ni couleur de fond.",
  "Utilise le thème reçu (paramètres theme et accent) pour le texte et le bouton principal.",
  "Aucun logo, publicité ni promotion dans la page : le nom de l'app est déjà affiché par Gozly.",
  "Aucun pop-up, redirection ni lien vers un autre site dans ta page. Pour renvoyer vers ton tableau de bord, utilise le bouton prévu par Gozly.",
  "Ne demande jamais le mot de passe Gozly ni un paiement dans ta page. La facturation se fait sur ton site, avec le bouton « Ouvrir ».",
  "Fonctionne en français (et en anglais si ton app l'est), sur ordinateur et sur mobile.",
  "Page rapide. Si ton service est en panne, affiche un message clair.",
];

export const FICHE_VIDE = {
  nom: "",
  description_courte: "",
  description_longue: "",
  icone: "",
  categorie: "ventes",
  url_service: "",
  url_retour: "",
  url_page: "",
  url_externe: "",
  regles_page: false,
  permissions: [],
  courriel_support: "",
  url_confidentialite: "",
  payant: false,
  prix: "",
};

const urlValide = (s) => {
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
};

// Renvoie le message d'erreur de la première règle non respectée, ou null. Une fiche soumise doit être complète.
export function verifierFiche(f) {
  if (!f.nom.trim()) return "Le nom est requis.";
  if (!f.description_courte.trim()) return "La description courte est requise.";
  if (!f.icone) return "L'icône est requise.";
  if (!urlValide(f.url_service)) return "L'adresse du service doit commencer par https://";
  if (!urlValide(f.url_retour)) return "L'adresse de retour doit commencer par https://";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.courriel_support)) return "Le courriel de support est invalide.";
  if (!urlValide(f.url_confidentialite)) return "Le lien de confidentialité doit commencer par https://";
  if (f.url_externe.trim() && !urlValide(f.url_externe)) return "L'adresse du tableau de bord doit commencer par https://";
  if (f.url_page.trim() && !urlValide(f.url_page)) return "L'adresse de la page doit commencer par https://";
  if (f.url_page.trim() && !f.regles_page) return "Confirme que ta page respecte les règles.";
  if (f.payant && !f.prix.trim()) return "Indique le prix.";
  return null;
}

// Réduit l'image choisie à 128 x 128 (PNG) pour la garder légère dans la base.
export function lireIcone(fichier) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(fichier);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext("2d");
      const cote = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - cote) / 2, (img.height - cote) / 2, cote, cote, 0, 0, 128, 128);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible."));
    };
    img.src = url;
  });
}
