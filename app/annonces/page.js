import Link from "next/link";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Gozyx from "@/components/Gozyx";
import TexteAnnonce from "@/components/TexteAnnonce";
import { annoncesPubliees } from "@/lib/annoncesSite";
import { getLang } from "@/lib/i18n/siteServer";

export const dynamic = "force-dynamic";

const TXT = {
  fr: {
    meta: "Gozly - Annonces",
    titre: "Annonces",
    sous: "Les nouveautés et les nouvelles de Gozly, en un seul endroit.",
    vide: "Aucune annonce pour l'instant. Gozyx te prévient dès qu'il y a du nouveau!",
    langue: "Les annonces sont publiées en français.",
    aide: "Une question? Va au centre d'aide",
  },
  en: {
    meta: "Gozly - Announcements",
    titre: "Announcements",
    sous: "What's new at Gozly, all in one place.",
    vide: "No announcements yet. Gozyx will let you know as soon as there's news!",
    langue: "Announcements are published in French.",
    aide: "Got a question? Visit the help center",
  },
};

export function generateMetadata() {
  return { title: TXT[getLang()].meta };
}

export default async function AnnoncesPage() {
  const lang = getLang();
  const T = TXT[lang];
  const { annonces, erreur } = await annoncesPubliees(30);
  const formatDate = (iso) => new Date(iso).toLocaleDateString(lang === "en" ? "en-CA" : "fr-CA", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <Gozyx humeur="content" taille={110} />
          <h1 style={{ marginTop: "14px" }}>{T.titre}</h1>
          <p>{T.sous}</p>
        </div>
      </header>

      <section>
        <div className="wrap annonces-wrap">
          {lang === "en" && annonces.length > 0 && <p className="aide-note" style={{ textAlign: "center", marginBottom: "18px" }}>{T.langue}</p>}

          {annonces.length === 0 ? (
            <div className="aide-carte" style={{ textAlign: "center" }}>
              <Gozyx humeur="dort" taille={100} />
              <p style={{ marginTop: "14px", color: "var(--text-dim)" }}>{erreur ? T.vide : T.vide}</p>
            </div>
          ) : (
            annonces.map((a) => (
              <article key={a.id} id={`a-${a.id}`} className="aide-carte annonce-carte">
                <time className="annonce-date" dateTime={a.publie_le}>
                  {formatDate(a.publie_le)}
                </time>
                <h2 className="annonce-titre">{a.titre}</h2>
                {a.image_url && <img className="annonce-image" src={a.image_url} alt="" loading="lazy" />}
                <TexteAnnonce texte={a.contenu} />
              </article>
            ))
          )}

          <p className="aide-note" style={{ textAlign: "center", marginTop: "10px" }}>
            <Link href="/aide">{T.aide}</Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
