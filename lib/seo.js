// SEO : adresse du site, images de partage et fabrique de métadonnées (Google, réseaux sociaux, IA).
// Les images de partage (1200 x 630) sont dans public/partage/ ; leur adresse est complète (https://gozly.net/...) pour que
// Facebook, iMessage, LinkedIn, etc. les trouvent. Les adresses canoniques deviennent absolues grâce à metadataBase (app/layout.js).

export const SITE_URL = "https://gozly.net";
export const IMAGE_ACCUEIL = `${SITE_URL}/partage/gozly-accueil.jpg`;
export const IMAGE_SCATTEGORIES = `${SITE_URL}/partage/gozly-scattegories.jpg`;

// Métadonnées complètes d'une page publique : titre, description, adresse canonique, Open Graph (Facebook, LinkedIn,
// iMessage, Discord...) et carte Twitter/X. noindex : pour les pages utiles mais sans intérêt pour Google (connexion).
export function metaPage({ lang, chemin, titre, description, image = IMAGE_ACCUEIL, imageAlt, noindex = false }) {
  const locale = lang === "en" ? "en_CA" : "fr_CA";
  return {
    title: titre,
    description,
    alternates: { canonical: chemin },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: "website",
      url: chemin,
      siteName: "Gozly",
      locale,
      title: titre,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt || titre }],
    },
    twitter: { card: "summary_large_image", title: titre, description, images: [image] },
  };
}
