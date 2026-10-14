"use client";

import { useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useAnnonces } from "@/components/moi/AnnoncesContext";
import CarteRemplacement from "@/components/moi/CarteRemplacement";
import CarteAnnonce from "@/components/moi/CarteAnnonce";
import { useLangue } from "@/components/moi/LangueContext";
import { useRouter } from "next/navigation";
import { localeDate } from "@/lib/i18n/moi";
import { IconDiscussion } from "@/components/icons/GozlyIcons";

// Page « Annonces et rappels » : tout ce qui est en cours, y compris ce qu'on a déjà marqué « OK ».
export default function AnnoncesPage() {
  const router = useRouter();
  const { t, langue } = useLangue();
  const { items, messagesNonLus, remplacements, mesRemplacements, masquees, masquer, recharger } = useAnnonces();
  const [occupe, setOccupe] = useState(null);
  const [msg, setMsg] = useState(null); // { type: "ok" | "err", text }
  const appelsVisibles = remplacements.filter((r) => !masquees.has(r.id));

  // « Je prends » : le premier disponible obtient le quart ; l'échange suit ensuite son chemin d'approbation habituel.
  async function prendre(id) {
    setOccupe(id);
    setMsg(null);
    try {
      const res = await employeFetch("/api/employe-app/remplacements/prendre", { method: "POST", body: JSON.stringify({ appelId: id }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setMsg({ type: "ok", text: data.approuve ? t("rem.pris") : t("rem.prisManuel") });
      else setMsg({ type: "err", text: data.error || t("rem.erreur") });
    } catch {
      setMsg({ type: "err", text: t("rem.erreur") });
    }
    await recharger();
    setOccupe(null);
  }

  async function annuler(id) {
    setOccupe(id);
    try {
      await employeFetch(`/api/employe-app/remplacements?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {}
    await recharger();
    setOccupe(null);
  }

  return (
    <div>
      <h2>{t("annonces.titre")}</h2>
      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
      {items.length === 0 && messagesNonLus.length === 0 && appelsVisibles.length === 0 && mesRemplacements.length === 0 ? (
        <p className="chat-empty">{t("annonces.aucune")}</p>
      ) : (
        <div className="moi-annonces-page">
          {appelsVisibles.map((r) => (
            <CarteRemplacement key={r.id} r={r} busy={occupe === r.id} onPrends={() => prendre(r.id)} onPasDispo={() => masquer(r.id)} />
          ))}
          {mesRemplacements.map((r) => (
            <CarteRemplacement key={r.id} r={r} mienne busy={occupe === r.id} onAnnuler={() => annuler(r.id)} />
          ))}
          {messagesNonLus.map((c) => (
            <button key={c.id} type="button" className="moi-notif-message" onClick={() => router.push(`/moi/discussion?c=${c.id}`)}>
              <span className="moi-notif-message-icone">
                <IconDiscussion className="gozly-icon" />
              </span>
              <span className="moi-notif-message-texte">
                <strong>{c.titre}</strong>
                <span>{c.dernierMessage}</span>
              </span>
              <span className="moi-notif-message-heure">
                {new Date(c.dernierMessageDate).toLocaleTimeString(localeDate(langue), { hour: "2-digit", minute: "2-digit" })}
              </span>
            </button>
          ))}
          {items.map((a) => (
            <CarteAnnonce key={a.id} a={a} onOk={masquees.has(a.id) ? undefined : () => masquer(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
