import Link from "next/link";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FenetreApp from "@/components/FenetreApp";
import TiltCard from "@/components/TiltCard";
import TelechargerContent from "@/components/TelechargerContent";
import { getT } from "@/lib/i18n/siteServer";
import { metaPublic } from "@/lib/seoPages";
import { IconFlecheDroite } from "@/components/icons/Pictogrammes";

export function generateMetadata() {
  return metaPublic("telecharger");
}

// Page « Suite bureautique » (Textas + Calky). Les autres logiciels (kiosque, applications, jeux) sont dans /logiciels.
// Un bloc par logiciel : clé du logiciel (voir lib/logiciels.js), icône, capture d'écran, accroche et fonctions (clés « tele.* »).
const PRODUITS = [
  {
    logiciel: "texte",
    nom: "tele.titre",
    accroche: "suite.textas.accroche",
    icone: "/logiciels/texte.svg",
    capture: { src: "/logiciels/capture-textas.jpg", largeur: 1800, hauteur: 1128, alt: "suite.alt.textas" },
    fonctions: ["f1", "f2", "f3", "f4", "f5", "f6"],
  },
  {
    logiciel: "calky",
    nom: "tele.calky.titre",
    accroche: "suite.calky.accroche",
    icone: "/logiciels/calky.svg",
    capture: { src: "/logiciels/capture-calky.jpg", largeur: 1800, hauteur: 900, alt: "suite.alt.calky" },
    fonctions: ["c1", "c2", "c3", "c4", "c5", "c6"],
  },
];

const AVANTAGES = [
  { titre: "suite.av1.t", texte: "suite.av1.d" },
  { titre: "suite.av2.t", texte: "suite.av2.d" },
  { titre: "suite.av3.t", texte: "suite.av3.d" },
];

export default function TelechargerPage() {
  const { t } = getT();
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="suite-hero">
        <div className="wrap">
          <div className="eyebrow">{t("suite.eyebrow")}</div>
          <h1>{t("suite.h1")}</h1>
          <p className="suite-sous">{t("suite.sous")}</p>
          <div className="suite-cta">
            <a href="#textas" className="btn-pill-dark">
              {t("suite.cta.textas")} <IconFlecheDroite className="gozly-icon-inline" />
            </a>
            <a href="#calky" className="btn-pill-glass">
              {t("suite.cta.calky")}
            </a>
          </div>
          <ul className="suite-badges">
            <li>{t("suite.badge.windows")}</li>
            <li>{t("suite.badge.hors")}</li>
            <li>{t("suite.badge.compat")}</li>
            <li>{t("suite.badge.nuage")}</li>
          </ul>
        </div>

        <div className="suite-scene">
          <FenetreApp className="fenetre-textas" src="/logiciels/capture-textas.jpg" alt={t("suite.alt.textas")} titre="Textas" largeur={1800} hauteur={1128} priorite />
          <FenetreApp className="fenetre-calky" src="/logiciels/capture-calky.jpg" alt={t("suite.alt.calky")} titre="Calky" largeur={1800} hauteur={900} priorite />
        </div>
      </header>

      {PRODUITS.map((p, i) => (
        <section className="suite-produit" key={p.logiciel} id={p.logiciel === "texte" ? "textas" : p.logiciel}>
          <div className={`wrap suite-produit-rangee${i % 2 ? " inverse" : ""}`}>
            <div className="suite-produit-texte">
              <img className="suite-produit-icone" src={p.icone} alt="" width="72" height="72" />
              <h2>{t(p.nom)}</h2>
              <p className="suite-accroche">{t(p.accroche)}</p>
              <ul className="suite-fonctions">
                {p.fonctions.map((f) => (
                  <li key={f}>
                    <strong>{t(`tele.${f}t`)}</strong>
                    <span>{t(`tele.${f}d`)}</span>
                  </li>
                ))}
              </ul>
              <TelechargerContent logiciel={p.logiciel} />
              <p className="tele-dispo suite-dispo">{t("tele.dispo")}</p>
            </div>
            <div className="suite-produit-visuel">
              <TiltCard className="suite-tilt">
                <FenetreApp src={p.capture.src} alt={t(p.capture.alt)} titre={t(p.nom)} largeur={p.capture.largeur} hauteur={p.capture.hauteur} />
              </TiltCard>
            </div>
          </div>
        </section>
      ))}

      <section className="suite-pourquoi">
        <div className="wrap">
          <div className="sec-head suite-centre">
            <div className="eyebrow">{t("suite.pourquoi.eyebrow")}</div>
            <h2>{t("suite.pourquoi.titre")}</h2>
          </div>
          <div className="suite-avantages">
            {AVANTAGES.map((a) => (
              <div className="suite-avantage" key={a.titre}>
                <h3>{t(a.titre)}</h3>
                <p>{t(a.texte)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact-cta">
        <div className="wrap">
          <div className="cta-band">
            <h2>{t("suite.autres.titre")}</h2>
            <p>{t("suite.autres.texte")}</p>
            <Link href="/logiciels" className="btn-pill-dark">
              {t("suite.autres.btn")} <IconFlecheDroite className="gozly-icon-inline" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
