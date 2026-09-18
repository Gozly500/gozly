"use client";

import { useRouter } from "next/navigation";

export default function MoiRetour({ href = "/moi/parametres" }) {
  const router = useRouter();
  return (
    <button type="button" className="moi-retour" onClick={() => router.push(href)}>
      ‹ Retour
    </button>
  );
}
