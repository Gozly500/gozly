"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { employeFetch } from "@/lib/employeAuth";
import { lireStatutPush } from "@/components/moi/NotificationsPush";
import { useLangue } from "@/components/moi/LangueContext";

// Rappel discret en haut d'une page quand les notifications qui la
// concernent ne sont pas actives : soit l'appareil n'est pas abonné (bouton
// maître désactivé), soit l'employé a coupé les types listés dans `types`
// (colonnes notif_* de Paramètres > Notifications). Rien si le navigateur
// ne supporte pas les notifications.
export default function RappelNotifications({ types, sujet }) {
  const { t } = useLangue();
  const [etat, setEtat] = useState(null);

  useEffect(() => {
    let annule = false;
    Promise.all([
      lireStatutPush(),
      employeFetch("/api/employe-app/notifications/preferences")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ]).then(([statut, data]) => {
      if (!annule) setEtat({ statut, prefs: data?.preferences || {} });
    });
    return () => {
      annule = true;
    };
  }, []);

  if (!etat) return null;

  let message = null;
  if (etat.statut === "inactif") {
    message = t("rappel.disabledDevice");
  } else if (etat.statut === "actif" && types.some((ty) => etat.prefs[ty] === false)) {
    message = t(`rappel.disabled.${sujet}`);
  }
  if (!message) return null;

  return (
    <div className="moi-rappel">
      <span>🔕 {message}</span>
      <Link href="/moi/parametres/notifications">{t("rappel.activer")}</Link>
    </div>
  );
}
