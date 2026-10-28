import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AideContent from "@/components/AideContent";
import { AIDE_UI } from "@/lib/aide";
import { getLang } from "@/lib/i18n/siteServer";
import { metaPublic } from "@/lib/seoPages";

export function generateMetadata() {
  return metaPublic("aide");
}

export default function AidePage() {
  const ui = AIDE_UI[getLang()];
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{ui.titre}</h1>
          <p>{ui.sousTitre}</p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <AideContent />
        </div>
      </section>

      <Footer />
    </div>
  );
}
