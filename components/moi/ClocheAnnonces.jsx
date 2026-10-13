"use client";

import { useRouter } from "next/navigation";
import { useAnnonces } from "@/components/moi/AnnoncesContext";
import { useLangue } from "@/components/moi/LangueContext";
import { IconCloche } from "@/components/icons/Pictogrammes";

// Cloche de l'en-tête : ouvre « Annonces et rappels » ; la pastille compte ceux pas encore vus (« OK »).
export default function ClocheAnnonces() {
  const router = useRouter();
  const { t } = useLangue();
  const { nonVues } = useAnnonces();

  return (
    <button type="button" className="admin-icon-btn moi-header-icon-btn moi-cloche" onClick={() => router.push("/moi/annonces")} aria-label={t("annonces.titre")}>
      <IconCloche className="gozly-icon" />
      {nonVues > 0 && <span className="moi-cloche-pastille">{nonVues > 9 ? "9+" : nonVues}</span>}
    </button>
  );
}
