import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SettingsContent from "@/components/SettingsContent";

export const metadata = {
  title: "Gozly - Paramètres",
};

export default function SettingsPage() {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>Paramètres du compte</h1>
          <p>Gère ton compte, ton entreprise et ton abonnement.</p>
        </div>
      </header>

      <section id="settings-content">
        <SettingsContent />
      </section>

      <Footer />
    </div>
  );
}
