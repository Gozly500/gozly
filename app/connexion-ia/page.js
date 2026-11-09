import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AutorisationIA from "@/components/AutorisationIA";

// Page où le propriétaire autorise un assistant IA (ChatGPT, Claude...) à se connecter à son entreprise.
// Jamais indexée : on n'y arrive que depuis l'assistant, avec des paramètres OAuth.
export const metadata = {
  title: "Gozly - Connecter un assistant IA",
  robots: { index: false, follow: false },
};

export default function ConnexionIAPage() {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>Connecter un assistant IA</h1>
          <p>Autorise un assistant à travailler avec ton entreprise Gozly.</p>
        </div>
      </header>

      <section>
        <div className="wrap login-wrap">
          <AutorisationIA />
        </div>
      </section>

      <Footer />
    </div>
  );
}
