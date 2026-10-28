import { SITE_URL, IMAGE_ACCUEIL, IMAGE_SCATTEGORIES } from "@/lib/seo";

// Données structurées (schema.org) et contenu de la FAQ Scattegories. Tout ce qui est écrit ici doit rester vrai :
// les moteurs de recherche et les assistants IA le lisent comme la description officielle de Gozly.

const MODULES = {
  fr: [
    "Horaire et pointage des employés (pointage mobile avec géolocalisation, feuille de temps, export vers la paie)",
    "Inventaire connecté à Wix",
    "Suivi des ventes",
    "Relevés de températures conformes aux exigences du MAPAQ",
    "Gestion des commandes en ligne",
    "Tâches et planification",
    "Musique d'ambiance pour commerces (Sonos)",
    "Application mobile pour les employés, discussion d'équipe et demandes de congé",
  ],
  en: [
    "Employee scheduling and time clock (mobile punch-in with geolocation, timesheets, payroll export)",
    "Inventory connected to Wix",
    "Sales tracking",
    "Temperature logs built for Québec food safety (MAPAQ) requirements",
    "Online order management",
    "Tasks and planning",
    "Background music for stores (Sonos)",
    "Employee mobile app, team chat and time-off requests",
  ],
};

const DESCRIPTION = {
  fr: "Gozly est une plateforme modulaire de gestion pour les PME du Québec : horaire, pointage, inventaire, suivi des ventes, températures (MAPAQ), commandes et musique. Chaque entreprise active seulement les modules dont elle a besoin.",
  en: "Gozly is a modular management platform for small businesses in Québec: scheduling, time clock, inventory, sales tracking, temperature logs (MAPAQ), orders and music. Each business turns on only the modules it needs.",
};

const FORFAITS = {
  fr: [
    { nom: "Opale", prix: "25", description: "3 modules, 1 entreprise, assistance standard" },
    { nom: "Onyx", prix: "40", description: "5 modules, 3 entreprises, support prioritaire" },
    { nom: "Crystal", prix: "50", description: "Modules illimités, 5 entreprises, module personnalisé sur demande" },
  ],
  en: [
    { nom: "Opale", prix: "25", description: "3 modules, 1 business, standard support" },
    { nom: "Onyx", prix: "40", description: "5 modules, 3 businesses, priority support" },
    { nom: "Crystal", prix: "50", description: "Unlimited modules, 5 businesses, custom module on request" },
  ],
};

export function donneesAccueil(lang) {
  const l = lang === "en" ? "en" : "fr";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organisation`,
        name: "Gozly",
        url: SITE_URL,
        logo: `${SITE_URL}/icone-app-512`,
        image: `${IMAGE_ACCUEIL}`,
        email: "info@gozly.net",
        description: DESCRIPTION[l],
        areaServed: { "@type": "AdministrativeArea", name: "Québec" },
        knowsLanguage: ["fr-CA", "en-CA"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#site`,
        url: SITE_URL,
        name: "Gozly",
        inLanguage: ["fr-CA", "en-CA"],
        publisher: { "@id": `${SITE_URL}/#organisation` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#logiciel`,
        name: "Gozly",
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android, iOS",
        description: DESCRIPTION[l],
        featureList: MODULES[l],
        inLanguage: ["fr-CA", "en-CA"],
        publisher: { "@id": `${SITE_URL}/#organisation` },
        offers: FORFAITS[l].map((f) => ({
          "@type": "Offer",
          name: f.nom,
          description: f.description,
          price: f.prix,
          priceCurrency: "CAD",
          url: `${SITE_URL}/inscription?forfait=${f.nom.toLowerCase()}`,
        })),
      },
    ],
  };
}

// ---- Scattegories ----

export const FAQ_SCATTEGORIES = {
  fr: {
    titre: "Questions fréquentes sur Scattegories en ligne",
    questions: [
      {
        q: "C'est quoi Scattegories?",
        r: "Scattegories est un jeu où, pour une lettre tirée au hasard, il faut trouver un mot par catégorie (un animal, un pays, un métier...) avant la fin du compte à rebours. Les réponses que personne d'autre n'a données rapportent des points, les doublons n'en rapportent pas.",
      },
      {
        q: "Peut-on jouer gratuitement à Scattegories en français en ligne?",
        r: "Oui. Gozly Scattegories est gratuit, entièrement en français et ne demande aucune installation. C'est l'un des seuls Scattegories francophones en ligne.",
      },
      {
        q: "Comment jouer en multijoueur?",
        r: "Le maître du jeu crée une partie et partage son code. Chaque joueur rejoint la partie avec ce code depuis son propre appareil, puis les réponses sont comparées et les points comptés à la fin de chaque manche.",
      },
      {
        q: "Peut-on choisir les catégories et le temps?",
        r: "Oui. Tu peux ajouter, retirer ou mélanger les catégories, choisir la durée du compte à rebours, éviter les lettres difficiles (Q, W, X, Y, Z) et imprimer la carte de jeu si tu préfères jouer sur papier.",
      },
      {
        q: "Sur quels appareils peut-on jouer?",
        r: "Directement dans le navigateur d'un ordinateur, d'une tablette ou d'un cellulaire. Tu peux aussi afficher le jeu en plein écran sur un téléviseur pour jouer en groupe.",
      },
    ],
  },
  en: {
    titre: "Online Scattegories FAQ",
    questions: [
      {
        q: "What is Scattegories?",
        r: "Scattegories is a game where, for a randomly drawn letter, you have to find one word per category (an animal, a country, a job...) before the countdown ends. Answers nobody else gave earn points, duplicates don't.",
      },
      {
        q: "Can I play Scattegories online for free?",
        r: "Yes. Gozly Scattegories is free, works in French and English and needs no installation. It is one of the only French-language Scattegories games online.",
      },
      {
        q: "How does multiplayer work?",
        r: "The game master creates a game and shares its code. Each player joins with that code from their own device, then answers are compared and points counted at the end of each round.",
      },
      {
        q: "Can I choose the categories and the time?",
        r: "Yes. You can add, remove or shuffle categories, set the countdown length, skip the hard letters (Q, W, X, Y, Z) and print the game card if you prefer paper.",
      },
      {
        q: "Which devices can I play on?",
        r: "Right in the browser of a computer, tablet or phone. You can also show the game fullscreen on a TV to play as a group.",
      },
    ],
  },
};

export function donneesScattegories(lang) {
  const l = lang === "en" ? "en" : "fr";
  const faq = FAQ_SCATTEGORIES[l];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/scattegories#jeu`,
        name: l === "en" ? "Gozly Scattegories" : "Gozly Scattegories",
        url: `${SITE_URL}/scattegories`,
        image: `${IMAGE_SCATTEGORIES}`,
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        description:
          l === "en"
            ? "Free online Scattegories, solo or multiplayer. One of the only French-language Scattegories games online."
            : "Scattegories en ligne gratuit, en solo ou en multijoueur. L'un des seuls Scattegories francophones en ligne.",
        inLanguage: ["fr-CA", "en-CA"],
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
        publisher: { "@id": `${SITE_URL}/#organisation` },
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.questions.map((x) => ({
          "@type": "Question",
          name: x.q,
          acceptedAnswer: { "@type": "Answer", text: x.r },
        })),
      },
    ],
  };
}
