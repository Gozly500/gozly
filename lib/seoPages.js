import { getLang } from "@/lib/i18n/siteServer";
import { metaPage, IMAGE_ACCUEIL, IMAGE_SCATTEGORIES } from "@/lib/seo";

// Titre et description de chaque page publique, en français et en anglais (la langue suit celle du visiteur).
// Titres : ~60 caractères max, descriptions : ~155 max (ce que Google affiche sans couper).
const PAGES = {
  accueil: {
    chemin: "/",
    fr: {
      titre: "Gozly | Horaire, pointage et inventaire pour PME",
      description:
        "Horaire, pointage, inventaire, ventes, températures MAPAQ et commandes : Gozly réunit les outils de ta PME du Québec dans une seule plateforme modulaire.",
    },
    en: {
      titre: "Gozly | Scheduling, time clock and inventory for small businesses",
      description:
        "Scheduling, time clock, inventory, sales, temperature logs and orders: Gozly brings your small business tools together in one modular platform.",
    },
    imageAlt: { fr: "Gozly, la plateforme modulaire pour PME", en: "Gozly, the modular platform for small businesses" },
  },
  scattegories: {
    chemin: "/scattegories",
    image: IMAGE_SCATTEGORIES,
    fr: {
      titre: "Scattegories en ligne gratuit en français | Gozly",
      description:
        "Joue gratuitement à Scattegories en ligne, en solo ou en multijoueur. Gozly Scattegories est l'un des seuls Scattegories francophones en ligne.",
    },
    en: {
      titre: "Scattegories online, free, in French and English | Gozly",
      description:
        "Play Scattegories online for free, solo or multiplayer. Gozly Scattegories is one of the only French-language Scattegories games online.",
    },
    imageAlt: { fr: "Gozly Scattegories, le jeu en ligne", en: "Gozly Scattegories, the online game" },
  },
  contact: {
    chemin: "/contact",
    fr: {
      titre: "Contacter Gozly | Parle-nous de ton projet",
      description: "Parle-nous de ton entreprise : on te propose une première étape simple pour centraliser tes outils de gestion avec Gozly.",
    },
    en: {
      titre: "Contact Gozly | Tell us about your project",
      description: "Tell us about your business: we'll suggest a simple first step to bring your management tools together with Gozly.",
    },
  },
  inscription: {
    chemin: "/inscription",
    fr: {
      titre: "Créer un compte Gozly | Essaie la plateforme pour PME",
      description: "Crée ton compte Gozly et choisis les modules dont ta PME a besoin : horaire, pointage, inventaire, ventes, températures et plus.",
    },
    en: {
      titre: "Create a Gozly account | Try the small business platform",
      description: "Create your Gozly account and pick the modules your business needs: scheduling, time clock, inventory, sales, temperature logs and more.",
    },
  },
  aide: {
    chemin: "/aide",
    fr: {
      titre: "Centre d'aide Gozly | Guides et soutien",
      description: "Trouve des réponses sur l'utilisation de Gozly : modules, horaire, pointage, inventaire, températures, intégrations et plus.",
    },
    en: {
      titre: "Gozly Help Center | Guides and support",
      description: "Find answers about using Gozly: modules, scheduling, time clock, inventory, temperature logs, integrations and more.",
    },
  },
  telecharger: {
    chemin: "/telecharger",
    image: IMAGE_ACCUEIL,
    fr: {
      titre: "Suite bureautique Gozly | Textas et Calky pour Windows",
      description:
        "Textas (traitement de texte) et Calky (tableur): la suite bureautique de Gozly pour Windows, avec modèles prêts à remplir et enregistrement dans ton OneDrive ou Google Drive.",
    },
    en: {
      titre: "Gozly office suite | Textas and Calky for Windows",
      description:
        "Textas (word processor) and Calky (spreadsheet): Gozly's office suite for Windows, with ready-to-fill templates and saving to your OneDrive or Google Drive.",
    },
  },
  logiciels: {
    chemin: "/logiciels",
    fr: {
      titre: "Logiciels Gozly | Bureautique, kiosque, applications et jeux",
      description:
        "Tous les logiciels Gozly par catégorie: Textas et Calky, kiosque Android, applications des employés et des gestionnaires, et le jeu Scattegories.",
    },
    en: {
      titre: "Gozly software | Office, kiosk, apps and games",
      description:
        "All Gozly software by category: Textas and Calky, the Android kiosk, employee and manager apps, and the Scattegories game.",
    },
  },
  statut: {
    chemin: "/statut",
    fr: { titre: "État du service Gozly | Statut en direct", description: "Consulte l'état en direct des services Gozly et les incidents en cours." },
    en: { titre: "Gozly service status | Live status", description: "Check the live status of Gozly services and any ongoing incidents." },
  },
  conditions: {
    chemin: "/conditions",
    fr: { titre: "Conditions d'utilisation | Gozly", description: "Les conditions d'utilisation de la plateforme Gozly." },
    en: { titre: "Terms of use | Gozly", description: "The terms of use of the Gozly platform." },
  },
  confidentialite: {
    chemin: "/confidentialite",
    fr: { titre: "Politique de confidentialité | Gozly", description: "Comment Gozly protège et utilise tes renseignements personnels." },
    en: { titre: "Privacy policy | Gozly", description: "How Gozly protects and uses your personal information." },
  },
  connexion: {
    chemin: "/login",
    noindex: true,
    fr: { titre: "Connexion | Gozly", description: "Connecte-toi à ton compte Gozly." },
    en: { titre: "Sign in | Gozly", description: "Sign in to your Gozly account." },
  },
};

// Métadonnées d'une page publique (à appeler dans generateMetadata de la page).
export function metaPublic(cle) {
  const lang = getLang() === "en" ? "en" : "fr";
  const page = PAGES[cle];
  return metaPage({
    lang,
    chemin: page.chemin,
    titre: page[lang].titre,
    description: page[lang].description,
    image: page.image || IMAGE_ACCUEIL,
    imageAlt: page.imageAlt?.[lang],
    noindex: !!page.noindex,
  });
}
