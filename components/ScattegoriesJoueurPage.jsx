"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ScattegoriesJoueur from "@/components/ScattegoriesJoueur";
import { normaliserCode } from "@/lib/scattegoriesRoom";

// Écran joueur : lit ?code=ABCD dans l'adresse (prérempli), "Retour" ramène au choix.
export default function ScattegoriesJoueurPage() {
  const router = useRouter();
  const [code, setCode] = useState(null);

  useEffect(() => {
    setCode(normaliserCode(new URLSearchParams(window.location.search).get("code")));
  }, []);

  if (code === null) return null;
  return <ScattegoriesJoueur codeInitial={code} onQuitter={() => router.push("/scattegories")} />;
}
