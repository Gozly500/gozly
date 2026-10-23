"use client";

import { useLangue } from "@/components/moi/LangueContext";
import { formatHeures } from "@/components/moi/CartePaie";

// Carte « Heures travaillées » de l'horaire : le total de la semaine d'après les pointages (arrivée et départ),
// pas d'après l'horaire prévu. Cachée quand il n'y a aucun pointage cette semaine.
export default function CarteHeures({ heures }) {
  const { t } = useLangue();
  if (!heures?.aDesPointages) return null;

  const enCours = Object.values(heures.jours).some((j) => j.enCours);
  return (
    <div className="moi-heures">
      <div className="moi-heures-ligne">
        <span>
          <strong>{t("heures.semaine")}</strong>
          <small>{t("heures.source")}</small>
        </span>
        <span className="moi-heures-total">{formatHeures(heures.minutesTotal)}</span>
      </div>
      {enCours && <p className="moi-heures-note">{t("heures.enCoursNote")}</p>}
    </div>
  );
}
