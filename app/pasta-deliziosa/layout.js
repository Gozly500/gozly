// Page à part : pas indexée, et rien de Gozly dans l'onglet ni dans l'aperçu d'un lien partagé.
const titre = "Pasta Deliziosa";

export const metadata = {
  title: titre,
  description: titre,
  applicationName: titre,
  robots: { index: false, follow: false },
  alternates: { canonical: "/pasta-deliziosa" },
  openGraph: { title: titre, description: titre, siteName: titre, images: [] },
  twitter: { card: "summary", title: titre, description: titre, images: [] },
};

export default function Layout({ children }) {
  return children;
}
