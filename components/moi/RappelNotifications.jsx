"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { employeFetch } from "@/lib/employeAuth";
import { lireStatutPush } from "@/components/moi/NotificationsPush";

// Rappel discret en haut d'une page quand les notifications qui la
// concernent ne sont pas actives : soit l'appareil n'est pas abonné (bouton
// maître désactivé), soit l'employé a coupé les types listés dans `types`
// (colonnes notif_* de Paramètres > Notifications). Rien si le navigateur
// ne supporte pas les notifications.
export default function RappelNotifications({ types, sujet }) {
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
    message = "Les notifications sont désactivées sur cet appareil.";
  } else if (etat.statut === "actif" && types.some((t) => etat.prefs[t] === false)) {
    message = `Les notifications ${sujet} sont désactivées.`;
  }
  if (!message) return null;

  return (
    <div className="moi-rappel">
      <span>🔕 {message}</span>
      <Link href="/moi/parametres/notifications">Activer</Link>
    </div>
  );
}
