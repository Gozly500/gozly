"use client";

import { useLangue } from "@/components/moi/LangueContext";
import { localeDate } from "@/lib/i18n/moi";
import { IconEchange } from "@/components/icons/Pictogrammes";

// Un collègue cherche un remplaçant : « Je prends » (le premier disponible l'obtient) ou « Pas disponible » (la carte
// disparaît de cet appareil). `mienne` : mon propre appel, avec « Annuler l'appel ».
export default function CarteRemplacement({ r, mienne = false, busy = false, onPrends, onPasDispo, onAnnuler }) {
  const { t, langue } = useLangue();
  const date = new Date(`${r.date}T12:00:00`).toLocaleDateString(localeDate(langue), { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="moi-annonce remplacement" role="status">
      <div className="moi-annonce-tete">
        <span className="moi-annonce-titre">
          <IconEchange className="gozly-icon" /> {mienne ? t("rem.mienne") : t("rem.carte", { nom: r.demandeur })}
        </span>
      </div>
      <p className="moi-annonce-texte" style={{ marginBottom: "4px" }}>
        {date} · {r.debut}–{r.fin}
      </p>
      {(r.poste || r.succursale) && <p className="moi-annonce-fin" style={{ margin: "0 0 4px" }}>{[r.poste, r.succursale].filter(Boolean).join(" · ")}</p>}
      {r.note && <p className="moi-annonce-fin" style={{ margin: "0 0 8px" }}>« {r.note} »</p>}
      <div className="moi-annonce-actions">
        {mienne ? (
          <button type="button" className="admin-icon-btn" disabled={busy} onClick={onAnnuler}>
            {t("rem.annuler")}
          </button>
        ) : (
          <>
            <button type="button" className="submit-btn" disabled={busy} onClick={onPrends}>
              {t("rem.jePrends")}
            </button>
            <button type="button" className="admin-icon-btn" disabled={busy} onClick={onPasDispo}>
              {t("rem.pasDispo")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
