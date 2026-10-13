"use client";

import { useAnnonces } from "@/components/moi/AnnoncesContext";
import CarteAnnonce from "@/components/moi/CarteAnnonce";
import { useLangue } from "@/components/moi/LangueContext";
import { useRouter } from "next/navigation";
import { localeDate } from "@/lib/i18n/moi";
import { IconDiscussion } from "@/components/icons/GozlyIcons";

// Page « Annonces et rappels » : tout ce qui est en cours, y compris ce qu'on a déjà marqué « OK ».
export default function AnnoncesPage() {
  const router = useRouter();
  const { t, langue } = useLangue();
  const { items, messagesNonLus, masquees, masquer } = useAnnonces();

  return (
    <div>
      <h2>{t("annonces.titre")}</h2>
      {items.length === 0 && messagesNonLus.length === 0 ? (
        <p className="chat-empty">{t("annonces.aucune")}</p>
      ) : (
        <div className="moi-annonces-page">
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
