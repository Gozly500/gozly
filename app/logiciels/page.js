import Link from "next/link";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TiltCard from "@/components/TiltCard";
import TelechargerContent from "@/components/TelechargerContent";
import { getT } from "@/lib/i18n/siteServer";
import { metaPublic } from "@/lib/seoPages";
import { CATEGORIES_LOGICIELS, FICHES_LOGICIELS } from "@/lib/catalogueLogiciels";
import { IconFlecheDroite } from "@/components/icons/Pictogrammes";

export function generateMetadata() {
  return metaPublic("logiciels");
}

// Une carte de logiciel : icône, nom, où il fonctionne, description, avec quels forfaits, puis le bouton (téléchargement ou lien).
function CarteLogiciel({ cle, t }) {
  const f = FICHES_LOGICIELS[cle];
  return (
    <TiltCard className="cata-carte tilt-card">
      <div className="cata-carte-tete">
        {f.icone ? (
          <img className="cata-icone" src={f.icone} alt="" width="64" height="64" loading="lazy" />
        ) : (
          <div className="cata-icone cata-icone-lettre" aria-hidden="true">
            {f.lettre}
          </div>
        )}
        <div>
          <h3>{f.nom}</h3>
          <div className="cata-badges">
            {f.plateformes.map((p) => (
              <span className="cata-badge" key={p}>
                {t(p)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="cata-desc">{t(f.desc)}</p>
      <p className="cata-acces">{t(f.acces)}</p>
      <div className="cata-actions">
        {f.telechargement ? (
          <TelechargerContent logiciel={f.telechargement} compact />
        ) : (
          <Link href={f.lien} className="submit-btn">
            {t(f.cta)} <IconFlecheDroite className="gozly-icon-inline" />
          </Link>
        )}
      </div>
      {f.etapes && (
        <details className="cata-etapes">
          <summary>{t("cata.comment")}</summary>
          <ol>
            {f.etapes.map((e) => (
              <li key={e}>{t(e)}</li>
            ))}
          </ol>
        </details>
      )}
    </TiltCard>
  );
}

export default function LogicielsPage() {
  const { t } = getT();
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="cata-hero">
        <div className="wrap">
          <div className="eyebrow">{t("cata.eyebrow")}</div>
          <h1>{t("cata.h1")}</h1>
          <p className="cata-sous">{t("cata.sous")}</p>
          <nav className="cata-chips" aria-label={t("cata.eyebrow")}>
            {CATEGORIES_LOGICIELS.map((c) => (
              <a key={c.id} href={`#${c.id}`}>
                {t(c.titre)}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {CATEGORIES_LOGICIELS.map((cat) => (
        <section className="cata-section" id={cat.id} key={cat.id}>
          <div className="wrap">
            <div className="cata-section-tete">
              <h2>{t(cat.titre)}</h2>
              <p>{t(cat.texte)}</p>
            </div>
            <div className="cata-grille">
              {cat.logiciels.map((cle) => (
                <CarteLogiciel key={cle} cle={cle} t={t} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <section id="contact-cta">
        <div className="wrap">
          <div className="cta-band">
            <h2>{t("cata.avenir.titre")}</h2>
            <p>{t("cata.avenir.texte")}</p>
            <Link href="/contact" className="btn-pill-dark">
              {t("cata.avenir.btn")} <IconFlecheDroite className="gozly-icon-inline" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
