"use client";

import { useRouter } from "next/navigation";
import { useLangue } from "@/components/moi/LangueContext";
import Pictos from "@/components/icons/Pictos";

export default function MoiRetour({ href = "/moi/parametres" }) {
  const router = useRouter();
  const { t } = useLangue();
  return (
    <button type="button" className="moi-retour" onClick={() => router.push(href)}>
      <Pictos texte={t("retour")} />
    </button>
  );
}
