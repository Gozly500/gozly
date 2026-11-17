"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { KIOSQUES } from "@/lib/kiosques";
import { desepinglerKiosque, kiosqueEpingle, surChangementEpingle } from "@/lib/kiosqueEpingle";

// Tant qu'un kiosque est épinglé (voir lib/kiosqueEpingle.js), toute autre page du kiosque ramène au kiosque épinglé.
// Après un déverrouillage par NIP, on se retrouve donc directement sur le kiosque épinglé.
export default function GardeKiosqueEpingle() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function verifier() {
      const id = kiosqueEpingle();
      if (!id) return;
      if (!KIOSQUES.some((k) => k.id === id)) {
        desepinglerKiosque(); // kiosque inconnu : on n'enferme personne
        return;
      }
      const cible = `/kiosque/${id}`;
      if (pathname !== cible) router.replace(cible);
    }
    verifier();
    return surChangementEpingle(verifier);
  }, [pathname, router]);

  return null;
}
