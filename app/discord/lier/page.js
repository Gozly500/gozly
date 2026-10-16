import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import DiscordLierContent from "@/components/DiscordLierContent";
import { getLang } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  return { title: getLang() === "en" ? "Gozly - Link Discord" : "Gozly - Lier Discord" };
}

export default function DiscordLierPage() {
  const en = getLang() === "en";
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{en ? "Link your Discord" : "Lier ton Discord"}</h1>
          <p>{en ? "Connect your Gozly account to the Gozly Discord server." : "Relie ton compte Gozly au serveur Discord de Gozly."}</p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <DiscordLierContent />
        </div>
      </section>

      <Footer />
    </div>
  );
}
