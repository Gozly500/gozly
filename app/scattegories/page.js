import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ScattegoriesChoix from "@/components/ScattegoriesChoix";
import { getT } from "@/lib/i18n/siteServer";
import JsonLd from "@/components/JsonLd";
import { metaPublic } from "@/lib/seoPages";
import { donneesScattegories, FAQ_SCATTEGORIES } from "@/lib/seoDonnees";

export function generateMetadata() {
  return metaPublic("scattegories");
}

export default function ScattegoriesPage() {
  const { t, lang } = getT();
  const faq = FAQ_SCATTEGORIES[lang === "en" ? "en" : "fr"];
  return (
    <div className="page page-default scat-page">
      <JsonLd data={donneesScattegories(lang)} />
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

      <section className="seo-faq-section">
        <div className="wrap seo-faq">
          <h2>{faq.titre}</h2>
          {faq.questions.map((x) => (
            <details key={x.q}>
              <summary>{x.q}</summary>
              <p>{x.r}</p>
            </details>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
