import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SettingsForm from "@/components/SettingsForm";

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
          <p>Modifie tes informations personnelles.</p>
        </div>
      </header>

      <section id="settings-form">
        <div className="wrap login-wrap">
          <SettingsForm />
        </div>
      </section>

      <Footer />
    </div>
  );
}
