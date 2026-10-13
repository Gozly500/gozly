"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";

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

// Mémorise sur l'appareil que l'employé VEUT les notifications (il les a activées, et ne les a pas
// désactivées lui-même) : c'est ce qui autorise la réparation automatique ci-dessous.
const CLE_PUSH_VOULU = "gozly_push_voulu";
const CLE_PUSH_SYNC = "gozly_push_sync";
const SYNC_MAX_MS = 24 * 3600 * 1000;

function memoriser(cle, valeur) {
  try {
    if (valeur === null) window.localStorage.removeItem(cle);
    else window.localStorage.setItem(cle, valeur);
  } catch {}
}

// Android (surtout Samsung : « mettre en veille les applis inutilisées », nettoyage de la batterie, Chrome qui
// retire les permissions des sites peu visités) et les services de notification des navigateurs peuvent
// faire disparaître l'abonnement push sans que l'employé n'ait rien touché. Appelé à chaque ouverture de l'app :
// - la permission est toujours accordée mais l'abonnement a disparu, et l'employé voulait les notifications
//   -> on se réabonne en silence (aucun clic requis, la permission est déjà là) ;
// - sinon, on renvoie l'abonnement au serveur au plus une fois par jour, au cas où il l'aurait supprimé.
// Si c'est la PERMISSION qui a été retirée, seul un clic de l'employé peut la redonner (règle du navigateur).
export async function repareAbonnementPush() {
  if (!supporte() || Notification.permission !== "granted" || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
  try {
    const registration = await navigator.serviceWorker.register("/sw-push.js");
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    let recree = false;

    if (!subscription) {
      if (window.localStorage.getItem(CLE_PUSH_VOULU) !== "1") return;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });
      recree = true;
    } else {
      // Déjà abonné : c'est qu'il les voulait (les anciens abonnés n'avaient pas encore cette mémoire).
      memoriser(CLE_PUSH_VOULU, "1");
    }

    const derniere = Number(window.localStorage.getItem(CLE_PUSH_SYNC) || 0);
    if (!recree && Date.now() - derniere < SYNC_MAX_MS) return;

    const res = await employeFetch("/api/employe-app/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (res.ok) memoriser(CLE_PUSH_SYNC, String(Date.now()));
  } catch (err) {
    console.error("Erreur réparation notifications:", err);
  }
}

// Bouton "Activer les notifications" pour la page Discussion de l'app
// employé - averti par une notif push quand un message arrive, sans avoir
// besoin de garder l'app ouverte. Repose sur le Push API standard (pas
// besoin d'app native) ; sur iPhone, ça ne fonctionne que si l'app a été
// installée sur l'écran d'accueil (voir InstallerApp.jsx) et iOS 16.4+.
export default function NotificationsPush() {
  const { t } = useLangue();
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

      if (res.ok) memoriser(CLE_PUSH_VOULU, "1");
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
      memoriser(CLE_PUSH_VOULU, null); // il les a coupées lui-même : pas de réabonnement automatique
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
          {t("push.actif")}
        </button>
      ) : (
        <button type="button" className="admin-icon-btn" onClick={activer} disabled={busy}>
          {statut === "erreur" ? t("push.reessayer") : t("push.activer")}
        </button>
      )}
    </div>
  );
}
