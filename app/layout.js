import "./globals.css";
import { LangProvider } from "@/components/LangProvider";
import { getLang } from "@/lib/i18n/siteServer";
import { SITE_URL, IMAGE_ACCUEIL } from "@/lib/seo";

export function generateMetadata() {
  const en = getLang() === "en";
  const titre = en ? "Gozly | Scheduling, time clock and inventory for small businesses" : "Gozly | Horaire, pointage et inventaire pour PME";
  const description = en
    ? "Scheduling, time clock, inventory, sales, temperature logs and orders: Gozly brings your small business tools together in one modular platform."
    : "Horaire, pointage, inventaire, ventes, températures MAPAQ et commandes : Gozly réunit les outils de ta PME du Québec dans une seule plateforme modulaire.";
  return {
    metadataBase: new URL(SITE_URL),
    title: titre,
    description,
    applicationName: "Gozly",
    authors: [{ name: "Gozly", url: SITE_URL }],
    creator: "Gozly",
    publisher: "Gozly",
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      siteName: "Gozly",
      locale: en ? "en_CA" : "fr_CA",
      title: titre,
      description,
      images: [{ url: IMAGE_ACCUEIL, width: 1200, height: 630, alt: "Gozly" }],
    },
    twitter: { card: "summary_large_image", title: titre, description, images: [IMAGE_ACCUEIL] },
  };
}

export default function RootLayout({ children }) {
  const lang = getLang();
  return (
    <html lang={lang} translate="no">
      <head>
        <meta name="google" content="notranslate" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
