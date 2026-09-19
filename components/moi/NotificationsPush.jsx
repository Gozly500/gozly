"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function supporte() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// "indisponible" | "inactif" | "actif" - utilisé aussi par RappelNotifications.
export async function lireStatutPush() {
  if (!supporte()) return "indisponible";
  try {
    const registration = await navigator.serviceWorker.register("/sw-push.js");
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? "actif" : "inactif";
  } catch (err) {
    console.error("Erreur vérification notifications:", err);
    return "indisponible";
  }
}

// Bouton "Activer les notifications" pour la page Discussion de l'app
// employé - averti par une notif push quand un message arrive, sans avoir
// besoin de garder l'app ouverte. Repose sur le Push API standard (pas
// besoin d'app native) ; sur iPhone, ça ne fonctionne que si l'app a été
// installée sur l'écran d'accueil (voir InstallerApp.jsx) et iOS 16.4+.
export default function NotificationsPush() {
  const [statut, setStatut] = useState("verification"); // verification | indisponible | inactif | actif | erreur
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    verifierStatut();
  }, []);

  async function verifierStatut() {
    setStatut(await lireStatutPush());
  }

  async function activer() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatut("inactif");
        setBusy(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });

      const res = await employeFetch("/api/employe-app/notifications/subscribe", {
        method: "POST",
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      setStatut(res.ok ? "actif" : "erreur");
    } catch (err) {
      console.error("Erreur activation notifications:", err);
      setStatut("erreur");
    }
    setBusy(false);
  }

  async function desactiver() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await employeFetch("/api/employe-app/notifications/unsubscribe", {
          method: "POST",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatut("inactif");
    } catch (err) {
      console.error("Erreur désactivation notifications:", err);
    }
    setBusy(false);
  }

  if (statut === "verification" || statut === "indisponible") return null;

  return (
    <div className="moi-notifications-bar">
      {statut === "actif" ? (
        <button type="button" className="admin-icon-btn" onClick={desactiver} disabled={busy}>
          🔔 Notifications activées
        </button>
      ) : (
        <button type="button" className="admin-icon-btn" onClick={activer} disabled={busy}>
          {statut === "erreur" ? "Réessayer d'activer les notifications" : "🔕 Activer les notifications"}
        </button>
      )}
    </div>
  );
}
