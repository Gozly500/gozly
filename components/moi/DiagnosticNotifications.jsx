"use client";

import { useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";
import { IconCrochet, IconX, IconAttention } from "@/components/icons/Pictogrammes";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Diagnostic des notifications, étape par étape, avec un vrai test : sert à trouver pourquoi un appareil ne reçoit rien.
// Chaque ligne : niveau "ok" | "mauvais" | "attention", un texte, et au besoin ce qu'il faut faire.
export default function DiagnosticNotifications() {
  const { t } = useLangue();
  const [lignes, setLignes] = useState(null);
  const [busy, setBusy] = useState(false);

  async function lancer() {
    setBusy(true);
    const out = [];
    const ajouter = (niveau, cle, aide) => out.push({ niveau, texte: t(cle), aide: aide ? t(aide) : null });
    const fin = () => {
      setLignes(out);
      setBusy(false);
    };
    setLignes([]);

    // 1. L'appareil sait-il faire des notifications ?
    const supporte = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supporte) {
      ajouter("mauvais", "diag.nonSupporte", "diag.aideNonSupporte");
      return fin();
    }
    ajouter("ok", "diag.supporte");

    // 2. Application installée ou simple page du navigateur ?
    const installee = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    ajouter(installee ? "ok" : "attention", installee ? "diag.installee" : "diag.pasInstallee", installee ? null : "diag.aidePasInstallee");

    // 3. Permission
    const permission = Notification.permission;
    if (permission === "denied") {
      ajouter("mauvais", "diag.permissionRefusee", "diag.aidePermissionRefusee");
      return fin();
    }
    if (permission === "default") {
      ajouter("mauvais", "diag.permissionAbsente", "diag.aidePermissionAbsente");
      return fin();
    }
    ajouter("ok", "diag.permissionOk");

    // 4. Service worker et abonnement de cet appareil (recréé en silence s'il a disparu : la permission est déjà là)
    let abonnement = null;
    try {
      const registration = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;
      abonnement = await registration.pushManager.getSubscription();
      if (!abonnement && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        abonnement = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) });
        ajouter("attention", "diag.abonnementRecree");
      } else if (abonnement) {
        ajouter("ok", "diag.abonnementOk");
      }
    } catch {
      ajouter("mauvais", "diag.serviceWorkerErreur", "diag.aideServiceWorker");
      return fin();
    }
    if (!abonnement) {
      ajouter("mauvais", "diag.abonnementAbsent", "diag.aideAbonnementAbsent");
      return fin();
    }

    // 5. On s'assure que le serveur connaît cet abonnement, puis on envoie un vrai test.
    try {
      await employeFetch("/api/employe-app/notifications/subscribe", { method: "POST", body: JSON.stringify({ subscription: abonnement.toJSON() }) });
      const res = await employeFetch("/api/employe-app/notifications/test", { method: "POST", body: JSON.stringify({ endpoint: abonnement.endpoint }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        ajouter("mauvais", "diag.serveurErreur");
      } else if (data.configure === false) {
        ajouter("mauvais", "diag.serveurNonConfigure", "diag.aideServeurNonConfigure");
      } else if (!data.trouve) {
        ajouter("mauvais", "diag.serveurIgnore", "diag.aideServeurIgnore");
      } else {
        const r = data.resultats?.[0];
        if (r?.ok) {
          ajouter("ok", "diag.testEnvoye", "diag.aideTestEnvoye");
        } else if (r?.expire) {
          ajouter("mauvais", "diag.abonnementExpire", "diag.aideAbonnementExpire");
        } else {
          ajouter("mauvais", "diag.testRefuse", "diag.aideTestRefuse");
          out[out.length - 1].texte += " (" + (r?.statut || "?") + ")";
        }
      }
      if (data.notifMessages === false) ajouter("attention", "diag.messagesCoupes", "diag.aideMessagesCoupes");
      if (data.heuresCalmes) ajouter("attention", "diag.heuresCalmesMaintenant", "diag.aideHeuresCalmes");
    } catch {
      ajouter("mauvais", "diag.serveurErreur");
    }
    fin();
  }

  const Icone = { ok: IconCrochet, mauvais: IconX, attention: IconAttention };
  const couleur = { ok: "#7ee2a8", mauvais: "#ff9494", attention: "#ffd479" };

  return (
    <div style={{ marginTop: "22px" }}>
      <div style={{ height: "1px", background: "rgba(var(--w),0.16)", margin: "0 0 18px" }} />
      <h4 style={{ margin: "0 0 4px" }}>{t("diag.titre")}</h4>
      <p className="panel-hint" style={{ marginTop: 0 }}>{t("diag.hint")}</p>
      <button type="button" className="admin-icon-btn" onClick={lancer} disabled={busy}>
        {busy ? t("diag.enCours") : t("diag.bouton")}
      </button>

      {lignes && lignes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
          {lignes.map((l, i) => {
            const I = Icone[l.niveau];
            return (
              <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ color: couleur[l.niveau], flexShrink: 0, marginTop: "2px" }}>
                  <I className="gozly-icon" />
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{l.texte}</div>
                  {l.aide && <div className="panel-hint" style={{ margin: "2px 0 0" }}>{l.aide}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
