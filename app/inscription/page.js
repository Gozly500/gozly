import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SignupForm from "@/components/SignupForm";
import { getT } from "@/lib/i18n/siteServer";
import { metaPublic } from "@/lib/seoPages";

export function generateMetadata() {
  return metaPublic("inscription");
}

export default function SignupPage() {
  const { t } = getT();
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{t("signup.titre")}</h1>
          <p>{t("signup.sous")}</p>
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
