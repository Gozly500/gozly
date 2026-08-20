import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata = {
  title: "Gozly - Réinitialiser le mot de passe",
};

export default function ResetPasswordPage() {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>Nouveau mot de passe</h1>
          <p>Choisis un nouveau mot de passe pour ton compte.</p>
        </div>
      </header>

      <section id="reset-password-form">
        <div className="wrap login-wrap">
          <ResetPasswordForm />
        </div>
      </section>

      <Footer />
    </div>
  );
}
