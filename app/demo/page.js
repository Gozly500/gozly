import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import DemoEntree from "@/components/DemoEntree";
import { getT } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  return { title: getT().t("demo.meta"), robots: { index: true, follow: true } };
}

// Page d'entrée de la démo : explique ce que c'est, puis le bouton ouvre le tableau de bord en mode démo
// (voir lib/demo/*). Aucune donnée n'est créée ici : tout se fait dans le navigateur, au clic.
export default function DemoPage() {
  const { t } = getT();
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <div className="eyebrow" style={{ marginBottom: "16px" }}>{t("demo.eyebrow")}</div>
          <h1>{t("demo.titre")}</h1>
          <p style={{ maxWidth: "620px" }}>{t("demo.sous")}</p>
          <div style={{ marginTop: "30px" }}>
            <DemoEntree />
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="etapes demo-points">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="etape rv" style={{ "--d": `${(n - 1) * 100}ms` }}>
                <span className="etape-num">{n}</span>
                <h3>{t(`demo.p${n}.t`)}</h3>
                <p>{t(`demo.p${n}.p`)}</p>
              </div>
            ))}
          </div>
          <p className="demo-note">{t("demo.note")}</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
