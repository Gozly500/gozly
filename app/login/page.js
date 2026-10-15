import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";
import { getT } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  return { title: getT().t("login.meta") };
}

export default function LoginPage() {
  const { t } = getT();
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{t("login.titre")}</h1>
          <p>{t("login.sous")}</p>
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
