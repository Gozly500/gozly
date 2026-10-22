import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TelechargerContent from "@/components/TelechargerContent";
import { getT } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  return { title: getT().t("tele.meta") };
}

// Un bloc par logiciel : clé du logiciel (voir lib/logiciels.js), clés de texte du titre, du sous-titre et des fonctions
const LOGICIELS_PAGE = [
  { logiciel: "texte", titre: "tele.titre", sous: "tele.sous", fonctions: ["f1", "f2", "f3", "f4", "f5", "f6"] },
  { logiciel: "calky", titre: "tele.calky.titre", sous: "tele.calky.sous", fonctions: ["c1", "c2", "c3", "c4", "c5", "c6"] },
];

export default function TelechargerPage() {
  const { t } = getT();
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{t("tele.hero")}</h1>
          <p>{t("tele.hero.sous")}</p>
        </div>
      </header>

      {LOGICIELS_PAGE.map((l) => (
        <section className="tele-section tele-logiciel" key={l.logiciel} id={l.logiciel}>
          <div className="wrap">
            <div className="tele-entete">
              <img className="tele-icone" src={`/logiciels/${l.logiciel}.svg`} alt="" width="84" height="84" />
              <h2 className="tele-nom">{t(l.titre)}</h2>
              <p className="tele-slogan">{t(l.sous)}</p>
            </div>
            <TelechargerContent logiciel={l.logiciel} />
            <p className="tele-dispo">{t("tele.dispo")}</p>
            <div className="tele-fonctions">
              {l.fonctions.map((f) => (
                <div className="tele-fonction" key={f}>
                  <h3>{t(`tele.${f}t`)}</h3>
                  <p>{t(`tele.${f}d`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

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
