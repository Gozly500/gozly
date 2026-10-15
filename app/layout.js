import "./globals.css";
import { LangProvider } from "@/components/LangProvider";
import { getLang } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  const en = getLang() === "en";
  return {
    title: "Gozly",
    description: en
      ? "Modular digital tools for small businesses that want to manage everything in one place."
      : "Des outils numériques modulaires pour les PME qui veulent tout gérer au même endroit.",
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
