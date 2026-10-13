"use client";

import { useLangue } from "@/components/moi/LangueContext";
import { localeDate } from "@/lib/i18n/moi";
import { IconCloche } from "@/components/icons/Pictogrammes";

// Une annonce (carte orangée) ou un rappel (carte bleue, avec le nom de son auteur). `onOk` : bouton « OK » qui la
// marque comme vue ; sans `onOk`, la carte s'affiche sans bouton (déjà vue).
export default function CarteAnnonce({ a, onOk }) {
  const { t, langue } = useLangue();
  return (
    <div className={`moi-annonce${a.rappelDe ? " rappel" : ""}`} role="status">
      <div className="moi-annonce-tete">
        <span className="moi-annonce-titre">
          <IconCloche className="gozly-icon" /> {a.rappelDe ? t("rap.de", { nom: a.rappelDe }) : t("annonce.titre")}
        </span>
        <span className="moi-annonce-fin">{t("annonce.jusqua", { date: new Date(a.fin).toLocaleDateString(localeDate(langue), { day: "numeric", month: "short" }) })}</span>
      </div>
      <p className="moi-annonce-texte">{a.contenu}</p>
      {onOk && (
        <button type="button" className="admin-icon-btn" onClick={onOk}>
          {t("annonce.ok")}
        </button>
      )}
    </div>
  );
}
