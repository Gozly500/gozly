"use client";

import { useAnnonces } from "@/components/moi/AnnoncesContext";
import CarteAnnonce from "@/components/moi/CarteAnnonce";
import { useLangue } from "@/components/moi/LangueContext";

// Page « Annonces et rappels » : tout ce qui est en cours, y compris ce qu'on a déjà marqué « OK ».
export default function AnnoncesPage() {
  const { t } = useLangue();
  const { items, masquees, masquer } = useAnnonces();

  return (
    <div>
      <h2>{t("annonces.titre")}</h2>
      {items.length === 0 ? (
        <p className="chat-empty">{t("annonces.aucune")}</p>
      ) : (
        <div className="moi-annonces-page">
          {items.map((a) => (
            <CarteAnnonce key={a.id} a={a} onOk={masquees.has(a.id) ? undefined : () => masquer(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
