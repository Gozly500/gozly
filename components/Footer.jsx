"use client";

import Link from "next/link";
import { useT } from "@/components/LangProvider";
import { LangFooterLink } from "@/components/LangSwitch";

export default function Footer() {
  const { t } = useT();
  return (
    <footer>
      <div className="wrap">
        <div className="footer-marque">
        <div className="brand" style={{ fontSize: "20px" }}>
          <span className="g-mark" style={{ width: "48px", height: "48px" }}>
            <img src="/gozly-logo-noel.svg" alt="" />
          </span>
          Gozly
        </div>
        <span className="footer-droits">{t("footer.droits")}</span>
        </div>
        <nav className="footer-colonnes" aria-label="Pied de page">
          <div className="footer-col">
            <h4>{t("footer.politiques")}</h4>
            <Link href="/conditions">{t("footer.conditions")}</Link>
            <Link href="/confidentialite">{t("footer.confidentialite")}</Link>
          </div>
          <div className="footer-col">
            <h4>{t("footer.liensUtiles")}</h4>
            <Link href="/aide">{t("footer.aide")}</Link>
            <Link href="/annonces">{t("footer.annonces")}</Link>
            <Link href="/statut">{t("footer.statut")}</Link>
          </div>
          <div className="footer-col">
            <h4>{t("footer.plus")}</h4>
            <Link href="/logiciels">{t("footer.logiciels")}</Link>
            <Link href="/scattegories">{t("footer.scat")}</Link>
            <Link href="/developpeur">{t("footer.dev")}</Link>
            <Link href="/marque">{t("footer.marque")}</Link>
            <LangFooterLink />
          </div>
        </nav>
      </div>
    </footer>
  );
}
