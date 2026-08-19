import Link from "next/link";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TiltCard from "@/components/TiltCard";

export const metadata = {
  title: "Gozly - S'abonner",
};

export default function SubscribePage() {
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>Nos forfaits</h1>
          <p>Choisis ton palier, active tes modules. Tu peux toujours en ajouter plus tard.</p>
        </div>
      </header>

      <section id="pricing">
        <div className="wrap">
          <div className="pricing">
            <TiltCard className="price-card tilt-card">
              <div className="price-head">
                <div className="price-icon pi-1"></div>
                <h3>Opale</h3>
              </div>
              <div className="price">
                25$<span>/mois</span>
              </div>
              <ul>
                <li>3 modules</li>
                <li>Assistance standard</li>
                <li>Mises à jour essentielles</li>
              </ul>
              <Link href="/contact" className="price-btn">
                Choisir ce forfait
              </Link>
            </TiltCard>
            <TiltCard className="price-card featured tilt-card">
              <div className="price-head">
                <div className="price-icon pi-2"></div>
                <h3>Onyx</h3>
              </div>
              <div className="price">
                40$<span>/mois</span>
              </div>
              <ul>
                <li>5 modules</li>
                <li>Support prioritaire</li>
                <li>Mises à jour avancées</li>
              </ul>
              <Link href="/contact" className="price-btn">
                Choisir ce forfait
              </Link>
            </TiltCard>
            <TiltCard className="price-card tilt-card">
              <div className="price-head">
                <div className="price-icon pi-3"></div>
                <h3>Crystal</h3>
              </div>
              <div className="price">
                50$<span>/mois</span>
              </div>
              <ul>
                <li>Modules illimités</li>
                <li>Assistance prioritaire</li>
                <li>Mises à jour avancées</li>
              </ul>
              <Link href="/contact" className="price-btn">
                Choisir ce forfait
              </Link>
            </TiltCard>
          </div>
        </div>
      </section>

      <section id="modules">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Modules disponibles</div>
            <h2>Ajoute ce dont tu as besoin.</h2>
            <p>Chaque forfait donne accès à un certain nombre de modules - choisis parmi ceux-ci.</p>
          </div>
          <div className="modules-stack">
            <div className="module-row">
              <div className="badge b-1">◆</div>
              <div className="module-row-text">
                <h3>Site vitrine</h3>
                <p>Un site rapide, moderne et à ton image pour présenter ton entreprise et convertir tes visiteurs.</p>
                <span className="wix-tag">Propulsé par Wix</span>
              </div>
            </div>
            <div className="module-row">
              <div className="badge b-2">▦</div>
              <div className="module-row-text">
                <h3>Dashboard sur mesure</h3>
                <p>Un espace privé pour toi et ton équipe, qui centralise l&apos;information au lieu de l&apos;éparpiller.</p>
              </div>
            </div>
            <div className="module-row">
              <div className="badge b-3">◷</div>
              <div className="module-row-text">
                <h3>Planning &amp; horaire</h3>
                <p>Un planning simple à mettre à jour, affiché où ton équipe en a besoin - même sur une tablette partagée.</p>
              </div>
            </div>
            <div className="module-row">
              <div className="badge b-4">✓</div>
              <div className="module-row-text">
                <h3>Pointage</h3>
                <p>Suivi des heures travaillées, simple pour les employés, clair pour toi au moment de la paie.</p>
              </div>
            </div>
            <div className="module-row">
              <div className="badge b-5">▤</div>
              <div className="module-row-text">
                <h3>Inventaire &amp; ventes</h3>
                <p>Un suivi de stock qui se met à jour avec tes ventes, pour ne plus jamais être pris au dépourvu.</p>
              </div>
            </div>
            <div className="module-row">
              <div className="badge b-6">✦</div>
              <div className="module-row-text">
                <h3>Et plus encore</h3>
                <p>D&apos;autres modules s&apos;ajoutent régulièrement à la plateforme, à mesure que de nouveaux besoins se présentent.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
