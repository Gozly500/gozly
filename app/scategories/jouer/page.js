import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ScategoriesJoueurPage from "@/components/ScategoriesJoueurPage";
import { getT } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  const { t } = getT();
  return { title: t("scat.meta"), description: t("scat.sous") };
}

export default function ScategoriesJouerPage() {
  const { t } = getT();
  return (
    <div className="page page-default scat-page">
      <Loader />
      <Nav />

      <header className="page-hero scat-hero">
        <div className="wrap">
          <h1>{t("scat.titre")}</h1>
          <p>{t("scat.rejoindre")}</p>
        </div>
      </header>

      <section id="scategories">
        <div className="wrap scat-wrap">
          <ScategoriesJoueurPage />
        </div>
      </section>

      <Footer />
    </div>
  );
}
