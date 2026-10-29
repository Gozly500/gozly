import Link from "next/link";
import { notFound } from "next/navigation";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import InstallationLogiciel from "@/components/InstallationLogiciel";
import { getT } from "@/lib/i18n/siteServer";
import { metaPublic } from "@/lib/seoPages";
import { LOGICIELS, cleParSlug } from "@/lib/logiciels";

export function generateMetadata() {
  return metaPublic("installation");
}

export function generateStaticParams() {
  return Object.values(LOGICIELS).map((l) => ({ logiciel: l.slug }));
}

const ICONES = { texte: "/logiciels/texte.svg", calky: "/logiciels/calky.svg", kiosque: "/icone-kiosque-512.png" };

// Page d'installation d'un logiciel : on y arrive en cliquant sur « Télécharger ». Le téléchargement démarre ici, et les étapes
// pour l'installer s'affichent en même temps. Les étapes dépendent de la plateforme (Windows ou Android).
export default function InstallationPage({ params }) {
  const cle = cleParSlug(params.logiciel);
  if (!cle) notFound();

  const { t } = getT();
  const { nom, slug, plateforme } = LOGICIELS[cle];
  const android = plateforme === "android";
  const etapes = android ? ["tele.kiosque.e1", "tele.kiosque.e2", "tele.kiosque.e3", "tele.kiosque.e4"] : ["inst.win.e1", "tele.e2", "tele.e3"];

  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="inst-hero">
        <div className="wrap">
          <img
            className="inst-icone"
            src={ICONES[cle]}
            alt=""
            width="96"
            height="96"
            style={cle === "kiosque" ? { borderRadius: "24px" } : undefined}
          />
          <h1>{t("inst.titre", { nom })}</h1>
          <p className="inst-sous">{t(android ? "inst.sous.android" : "inst.sous")}</p>
        </div>
      </header>

      <section className="inst-corps">
        <div className="wrap">
          <InstallationLogiciel logiciel={cle} />

          <div className="inst-etapes">
            <h2>{t("inst.etapesTitre")}</h2>
            <ol>
              {etapes.map((e) => (
                <li key={e}>{t(e)}</li>
              ))}
            </ol>
          </div>

          <Link href={android ? "/logiciels" : `/telecharger#${slug}`} className="inst-retour">
            {t("inst.retour")}
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
