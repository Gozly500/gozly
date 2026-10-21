import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TelechargerContent from "@/components/TelechargerContent";
import { getT } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  return { title: getT().t("tele.meta") };
}

const FONCTIONS = ["f1", "f2", "f3", "f4", "f5", "f6"];

export default function TelechargerPage() {
  const { t } = getT();
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{t("tele.titre")}</h1>
          <p>{t("tele.sous")}</p>
        </div>
      </header>

      <section className="tele-section">
        <div className="wrap">
          <TelechargerContent />
          <p className="tele-dispo">{t("tele.dispo")}</p>
        </div>
      </section>

      <section className="tele-section">
        <div className="wrap">
          <div className="tele-fonctions">
            {FONCTIONS.map((f) => (
              <div className="tele-fonction" key={f}>
                <h3>{t(`tele.${f}t`)}</h3>
                <p>{t(`tele.${f}d`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tele-section">
        <div className="wrap">
          <div className="tele-etapes">
            <h2>{t("tele.etapesTitre")}</h2>
            <ol>
              <li>{t("tele.e1")}</li>
              <li>{t("tele.e2")}</li>
              <li>{t("tele.e3")}</li>
            </ol>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
