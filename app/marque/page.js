import Link from "next/link";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BoutonsKit from "@/components/marque/BoutonsKit";
import CouleurCarte from "@/components/marque/CouleurCarte";
import * as Pack from "@/components/icons/PackIcones";
import { getT } from "@/lib/i18n/siteServer";
import { COULEURS, DEGRADE_SIGNATURE, POLICES, THEMES } from "@/lib/marque";
import { IconTelecharger } from "@/components/icons/Pictogrammes";

export function generateMetadata() {
  return { title: getT().t("marque.meta"), robots: { index: true, follow: true } };
}

const MODULES = [
  ["planning", "icone-planning.svg"],
  ["horaire", "icone-horaire.svg"],
  ["inventaire", "icone-inventaire.svg"],
  ["ventes", "icone-ventes.svg"],
  ["temperature", "icone-temperature.svg"],
  ["commandes", "icone-commandes.svg"],
  ["musique", "icone-musique.svg"],
];

function Section({ id, titre, sous, children }) {
  return (
    <section id={id} className="marque-section">
      <div className="wrap">
        <h2 className="marque-titre">{titre}</h2>
        {sous && <p className="marque-sous">{sous}</p>}
        {children}
      </div>
    </section>
  );
}

// Page « identité visuelle » : tout ce qu'il faut pour représenter Gozly (logo, couleurs, polices, pictogrammes, mascotte, style),
// avec le kit de marque (ZIP) et la charte graphique (PDF) à télécharger. Les données viennent de lib/marque.js.
export default function MarquePage() {
  const { t } = getT();
  const pictos = Object.entries(Pack);

  return (
    <div className="page page-default marque">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <div className="eyebrow" style={{ marginBottom: "16px" }}>{t("marque.eyebrow")}</div>
          <h1>{t("marque.titre")}</h1>
          <p style={{ maxWidth: "620px" }}>{t("marque.sous")}</p>
          <div style={{ marginTop: "30px" }}>
            <BoutonsKit />
          </div>
          <nav className="marque-ancres" aria-label="Sections">
            {[["logo", "marque.navLogo"], ["couleurs", "marque.navCouleurs"], ["typo", "marque.navTypo"], ["pictos", "marque.navPictos"], ["mascotte", "marque.navMascotte"], ["style", "marque.navStyle"]].map(([id, cle]) => (
              <a key={id} href={`#${id}`}>{t(cle)}</a>
            ))}
          </nav>
        </div>
      </header>

      <Section id="logo" titre={t("marque.logoTitre")} sous={t("marque.logoSous")}>
        <div className="marque-logos">
          <div className="marque-logo-tuile sombre rv">
            <img src="/gozly-logo.svg" alt="Gozly" width="96" height="96" />
            <span className="brand">Gozly</span>
            <small>{t("marque.logoSombre")}</small>
          </div>
          <div className="marque-logo-tuile clair rv" style={{ "--d": "100ms" }}>
            <img src="/gozly-logo.svg" alt="Gozly" width="96" height="96" />
            <span className="brand">Gozly</span>
            <small>{t("marque.logoClair")}</small>
          </div>
        </div>
        <ul className="marque-regles">
          {[1, 2, 3].map((n) => (
            <li key={n}>{t(`marque.logoRegle${n}`)}</li>
          ))}
        </ul>

        <h3 className="marque-sous-titre">{t("marque.appsTitre")}</h3>
        <div className="marque-apps">
          <figure>
            <img src="/gozly-app-icon.svg" alt="" width="88" height="88" />
            <figcaption>{t("marque.appEmploye")}</figcaption>
          </figure>
          <figure>
            <img src="/gozly-gestion-icon.svg" alt="" width="88" height="88" />
            <figcaption>{t("marque.appGestion")}</figcaption>
          </figure>
        </div>

        <h3 className="marque-sous-titre">{t("marque.modulesTitre")}</h3>
        <div className="marque-apps">
          {MODULES.map(([nom, fichier]) => (
            <figure key={nom}>
              <img src={`/${fichier}`} alt="" width="88" height="88" loading="lazy" />
              <figcaption style={{ textTransform: "capitalize" }}>{nom}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="couleurs" titre={t("marque.couleursTitre")} sous={t("marque.couleursSous")}>
        {[["marque.couleursPrincipales", COULEURS.principales], ["marque.couleursFonds", COULEURS.fonds], ["marque.couleursTexte", COULEURS.texte]].map(([cle, liste]) => (
          <div key={cle} className="marque-groupe">
            <h3 className="marque-sous-titre">{t(cle)}</h3>
            <div className="marque-couleurs">
              {liste.map((c) => (
                <CouleurCarte key={c.id} nom={c.nom} hex={c.hex} role={c.role} />
              ))}
            </div>
          </div>
        ))}
        <h3 className="marque-sous-titre">{t("marque.degrade")}</h3>
        <div className="marque-degrade" style={{ background: `linear-gradient(90deg, ${DEGRADE_SIGNATURE.join(", ")})` }} />
      </Section>

      <Section id="typo" titre={t("marque.typoTitre")} sous={t("marque.typoSous")}>
        <div className="marque-polices">
          {POLICES.map((p) => (
            <div key={p.id} className="marque-police rv">
              <div className="marque-police-aa" style={{ fontFamily: p.id === "fredoka" ? "'Fredoka', sans-serif" : "'Inter', sans-serif", fontWeight: p.id === "fredoka" ? 600 : 500 }}>Aa</div>
              <h3>{p.nom}</h3>
              <p className="marque-police-usage">{p.usage}</p>
              <p className="marque-police-graisses">{p.graisses}</p>
              <p className="marque-police-apercu" style={{ fontFamily: p.id === "fredoka" ? "'Fredoka', sans-serif" : "'Inter', sans-serif", fontWeight: p.id === "fredoka" ? 600 : 400 }}>
                {t("marque.typoApercu")}
              </p>
              <a href={p.lien} target="_blank" rel="noopener noreferrer" className="marque-lien">
                {t("marque.typoTelecharger")}
              </a>
            </div>
          ))}
        </div>
      </Section>

      <Section id="pictos" titre={t("marque.pictosTitre")} sous={t("marque.pictosSous")}>
        <div className="marque-pictos">
          {pictos.map(([nom, Icone]) => (
            <div key={nom} className="marque-picto" title={nom.replace("Pack", "")}>
              <Icone width="40" height="40" />
            </div>
          ))}
        </div>
        <div style={{ marginTop: "22px" }}>
          <a className="btn-pill-glass" href="/marque/pictogrammes-gozly.svg" download>
            <IconTelecharger className="gozly-icon" /> {t("marque.pictosTelecharger")}
          </a>
        </div>
      </Section>

      <Section id="mascotte" titre={t("marque.mascotteTitre")} sous={t("marque.mascotteSous")}>
        <div className="marque-mascottes">
          <img src="/marque/mascotte.png" alt="Mascotte Gozly" width="240" height="240" loading="lazy" />
        </div>
      </Section>

      <Section id="style" titre={t("marque.styleTitre")} sous={t("marque.styleSous")}>
        <div className="marque-style">
          <div className="marque-verre">
            <strong>{t("marque.styleCarte")}</strong>
            <p>{t("marque.styleCarteTexte")}</p>
            <div className="marque-boutons">
              <span className="submit-btn">{t("marque.styleBouton")}</span>
              <span className="btn-pill-glass">{t("marque.styleBoutonSec")}</span>
            </div>
          </div>
        </div>
        <h3 className="marque-sous-titre">{t("marque.themesTitre")}</h3>
        <div className="marque-themes">
          {THEMES.map((th) => (
            <div key={th.id} className="marque-theme" style={{ background: th.fond, color: th.id === "clair" ? "#1c1c22" : "#fff" }}>
              <span>{th.nom}</span>
              <i style={{ background: th.accent }} />
            </div>
          ))}
        </div>
      </Section>

      <section className="marque-section">
        <div className="wrap" style={{ textAlign: "center" }}>
          <p className="marque-sous" style={{ margin: "0 auto 18px" }}>{t("marque.pied")}</p>
          <Link href="/contact" className="btn-pill-glass">{t("marque.contact")}</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
