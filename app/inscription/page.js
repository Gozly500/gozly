import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SignupForm from "@/components/SignupForm";

export const metadata = {
  title: "Gozly - Créer un compte",
};

export default function SignupPage() {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>Créer un compte</h1>
          <p>Choisis ton forfait, active tes modules quand tu veux.</p>
        </div>
      </header>

      <section id="signup-form">
        <div className="wrap signup-wrap">
          <SignupForm />
        </div>
      </section>

      <Footer />
    </div>
  );
}
