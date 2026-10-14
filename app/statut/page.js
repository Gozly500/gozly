import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import StatutContent from "@/components/StatutContent";

export const metadata = {
  title: "Gozly - Statut des systèmes",
};

export default function StatutPage() {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>Statut des systèmes</h1>
          <p>L'état de Gozly en temps réel.</p>
        </div>
      </header>

      <section id="statut-content">
        <StatutContent />
      </section>

      <Footer />
    </div>
  );
}
