import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import DeveloppeurContent from "@/components/DeveloppeurContent";

export const metadata = { title: "Gozly pour développeurs", robots: { index: false } };

export default function DeveloppeurPage() {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <section style={{ padding: "150px 0 60px" }}>
        <div className="wrap">
          <DeveloppeurContent />
        </div>
      </section>

      <Footer />
    </div>
  );
}
