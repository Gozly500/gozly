import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ResetPasswordForm from "@/components/ResetPasswordForm";
import { getT } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  return { title: getT().t("reset.meta") };
}

export default function ResetPasswordPage() {
  const { t } = getT();
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{t("reset.titre")}</h1>
          <p>{t("reset.sous")}</p>
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
