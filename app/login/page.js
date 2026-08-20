import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";

export const metadata = {
  title: "Gozly - Se connecter",
};

export default function LoginPage() {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>Se connecter</h1>
          <p>Accède à ton tableau de bord.</p>
        </div>
      </header>

      <section id="login-form">
        <div className="wrap login-wrap">
          <LoginForm />
        </div>
      </section>

      <Footer />
    </div>
  );
}
