import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ScattegoriesChoix from "@/components/ScattegoriesChoix";
import { getT } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  const { t } = getT();
  return { title: t("scat.meta"), description: t("scat.sous") };
}

export default function ScattegoriesPage() {
  const { t } = getT();
  return (
    <div className="page page-default scat-page">
      <Loader />
      <Nav />

      <header className="page-hero scat-hero">
        <div className="wrap">
          <h1>{t("scat.titre")}</h1>
          <p>{t("scat.sous")}</p>
        </div>
      </header>

      <section id="scattegories">
        <div className="wrap scat-wrap">
          <ScattegoriesChoix />
        </div>
      </section>

      <Footer />
    </div>
  );
}
