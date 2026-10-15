import Link from "next/link";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import TiltCard from "@/components/TiltCard";
import { IconPlanning, IconHoraire, IconInventaire, IconVentes, IconTemperature } from "@/components/icons/GozlyIcons";
import { IconEcran } from "@/components/icons/Pictogrammes";
import { getT } from "@/lib/i18n/siteServer";

export function generateMetadata() {
  return { title: getT().t("abonner.meta") };
}

export default function SubscribePage() {
  const { t } = getT();
  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>{t("abonner.titre")}</h1>
          <p>{t("abonner.sous")}</p>
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
                {t("plan.opale.prix")}<span>{t("plan.mois")}</span>
              </div>
              <ul>
                <li>{t("plan.opale.l1")}</li>
                <li>{t("plan.opale.l2")}</li>
                <li>{t("plan.opale.l3")}</li>
                <li>{t("plan.opale.l4")}</li>
              </ul>
              <Link href="/inscription?forfait=opale" className="price-btn">
                {t("plan.choisir")}
              </Link>
            </TiltCard>
            <TiltCard className="price-card featured tilt-card">
              <div className="price-head">
                <div className="price-icon pi-2"></div>
                <h3>Onyx</h3>
              </div>
              <div className="price">
                {t("plan.onyx.prix")}<span>{t("plan.mois")}</span>
              </div>
              <ul>
                <li>{t("plan.onyx.l1")}</li>
                <li>{t("plan.onyx.l2")}</li>
                <li>{t("plan.onyx.l3")}</li>
                <li>{t("plan.onyx.l4")}</li>
              </ul>
              <Link href="/inscription?forfait=onyx" className="price-btn">
                {t("plan.choisir")}
              </Link>
            </TiltCard>
            <TiltCard className="price-card tilt-card">
              <div className="price-head">
                <div className="price-icon pi-3"></div>
                <h3>Crystal</h3>
              </div>
              <div className="price">
                {t("plan.crystal.prix")}<span>{t("plan.mois")}</span>
              </div>
              <ul>
                <li>{t("plan.crystal.l1")}</li>
                <li>{t("plan.crystal.l2")}</li>
                <li>{t("plan.crystal.l3")}</li>
                <li>{t("plan.crystal.l4")}</li>
                <li>{t("plan.crystal.l5")}</li>
              </ul>
              <Link href="/inscription?forfait=crystal" className="price-btn">
                {t("plan.choisir")}
              </Link>
            </TiltCard>
          </div>
        </div>
      </section>

      <section id="modules">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">{t("abonner.modules.eyebrow")}</div>
            <h2>{t("abonner.modules.titre")}</h2>
            <p>{t("abonner.modules.sous")}</p>
          </div>
          <div className="modules-stack">
            <div className="module-row">
              <div className="badge b-1"><IconEcran className="badge-icone" /></div>
              <div className="module-row-text">
                <h3>{t("abonner.vitrine.titre")}</h3>
                <p>{t("abonner.vitrine.texte")}</p>
                <span className="wix-tag">{t("abonner.vitrine.wix")}</span>
              </div>
            </div>
            <div className="module-row">
              <div className="badge b-3"><IconPlanning className="badge-icone" /></div>
              <div className="module-row-text">
                <h3>{t("abonner.taches.titre")}</h3>
                <p>{t("abonner.taches.texte")}</p>
              </div>
            </div>
            <div className="module-row">
              <div className="badge b-4"><IconHoraire className="badge-icone" /></div>
              <div className="module-row-text">
                <h3>{t("abonner.horaire.titre")}</h3>
                <p>{t("abonner.horaire.texte")}</p>
              </div>
            </div>
            <div className="module-row">
              <div className="badge b-5"><IconInventaire className="badge-icone" /></div>
              <div className="module-row-text">
                <h3>{t("abonner.inventaire.titre")}</h3>
                <p>{t("abonner.inventaire.texte")}</p>
              </div>
            </div>
            <div className="module-row">
              <div className="badge b-6"><IconVentes className="badge-icone" /></div>
              <div className="module-row-text">
                <h3>{t("abonner.ventes.titre")}</h3>
                <p>{t("abonner.ventes.texte")}</p>
              </div>
            </div>
            <div className="module-row">
              <div className="badge b-7"><IconTemperature className="badge-icone" /></div>
              <div className="module-row-text">
                <h3>{t("abonner.temperature.titre")}</h3>
                <p>{t("abonner.temperature.texte")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
