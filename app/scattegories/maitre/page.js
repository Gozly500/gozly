import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ScattegoriesGame from "@/components/ScattegoriesGame";
import { getT } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  const { t } = getT();
  return { title: t("scat.meta"), description: t("scat.sous") };
}

export default function ScattegoriesMaitrePage() {
  const { t } = getT();
  return (
    <div className="page page-default scat-page">
      <Loader />
      <Nav />

      <header className="page-hero scat-hero">
        <div className="wrap">
          <h1>{t("scat.titre")}</h1>
          <p>{t("scat.maitre")}</p>
        </div>
      </header>

      <section id="scattegories">
        <div className="wrap scat-wrap">
          <ScattegoriesGame />

          <div className="scat-regles">
            <h2>{t("scat.regles")}</h2>
            <h3>{t("scat.depart")}</h3>
            <ol>
              <li>{t("scat.regles.p1")}</li>
              <li>{t("scat.regles.p2")}</li>
              <li>{t("scat.regles.p3")}</li>
            </ol>
            <h3>{t("scat.deroulement")}</h3>
            <p>{t("scat.regles.p4")}</p>
            <p className="scat-astuce">{t("scat.astuce")}</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
