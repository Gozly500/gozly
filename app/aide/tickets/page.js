import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import MesTickets from "@/components/MesTickets";
import { getLang } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  return { title: getLang() === "en" ? "Gozly - My tickets" : "Gozly - Mes tickets" };
}

export default function MesTicketsPage() {
  const en = getLang() === "en";
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{en ? "Support tickets" : "Tickets de support"}</h1>
          <p>{en ? "Open a ticket and follow the team's answers." : "Ouvre un ticket et suis les réponses de l'équipe."}</p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <MesTickets />
        </div>
      </section>

      <Footer />
    </div>
  );
}
