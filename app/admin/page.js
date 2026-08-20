import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AdminContent from "@/components/AdminContent";

export const metadata = {
  title: "Gozly - Admin",
};

export default function AdminPage() {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>Panneau admin</h1>
          <p>Gère les comptes clients et l'équipe Gozly.</p>
        </div>
      </header>

      <section id="admin-content">
        <AdminContent />
      </section>

      <Footer />
    </div>
  );
}
