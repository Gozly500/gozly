"use client";

import { useRouter } from "next/navigation";
import { useLangue } from "@/components/moi/LangueContext";

export default function MoiRetour({ href = "/moi/parametres" }) {
  const router = useRouter();
  const { t } = useLangue();
  return (
    <button type="button" className="moi-retour" onClick={() => router.push(href)}>
      {t("retour")}
    </button>
  );
}
