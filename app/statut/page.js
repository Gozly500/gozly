import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import StatutContent from "@/components/StatutContent";
import { getT } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  return { title: getT().t("statut.meta") };
}

export default function StatutPage() {
  const { t } = getT();
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{t("statut.titre")}</h1>
          <p>{t("statut.sous")}</p>
          <div className="statut-carres" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </header>

      <section id="statut-content">
        <StatutContent />
      </section>

      <Footer />
    </div>
  );
}
