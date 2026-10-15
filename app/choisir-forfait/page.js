import { getT } from "@/lib/i18n/siteServer";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ChoisirForfaitContent from "@/components/ChoisirForfaitContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Choisir un forfait") };
}

export default function ChoisirForfaitPage() {
  const { t } = getT();
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{t("Choisis ton forfait")}</h1>
          <p>{t("Ton compte est créé. Choisis ton forfait pour activer tes modules.")}</p>
        </div>
      </header>

      <section id="pricing">
        <div className="wrap">
          <ChoisirForfaitContent />
        </div>
      </section>

      <Footer />
    </div>
  );
}
