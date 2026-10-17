import Link from "next/link";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Gozyx from "@/components/Gozyx";
import { getLang } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  return { title: getLang() === "en" ? "Gozly - Page not found" : "Gozly - Page introuvable" };
}

// Page 404 : Gozyx, un peu perdu, propose de revenir à l'accueil ou au centre d'aide.
export default function NotFound() {
  const en = getLang() === "en";
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <Gozyx humeur="probleme" taille={150} />
          <h1 style={{ marginTop: "18px" }}>404</h1>
          <p>{en ? "Oops, I couldn't find that page. It may have moved, or the link is wrong." : "Oups, je n'ai pas trouvé cette page. Elle a peut-être déménagé, ou le lien est erroné."}</p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "26px" }}>
            <Link href="/" className="submit-btn" style={{ display: "inline-block", textDecoration: "none" }}>
              {en ? "Back to home" : "Retour à l'accueil"}
            </Link>
            <Link href="/aide" className="aide-ticket-lien">
              {en ? "Help center" : "Centre d'aide"}
            </Link>
          </div>
        </div>
      </header>

      <Footer />
    </div>
  );
}
