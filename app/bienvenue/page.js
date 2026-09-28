import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import OnboardingContent from "@/components/OnboardingContent";

export const metadata = {
  title: "Gozly - Bienvenue",
};

export default function BienvenuePage() {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <section style={{ padding: "150px 0 60px" }}>
        <div className="wrap">
          <OnboardingContent />
        </div>
      </section>

      <Footer />
    </div>
  );
}
