"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ScategoriesJoueur from "@/components/ScategoriesJoueur";
import { normaliserCode } from "@/lib/scategoriesRoom";

// Écran joueur : lit ?code=ABCD dans l'adresse (prérempli), "Retour" ramène au choix.
export default function ScategoriesJoueurPage() {
  const router = useRouter();
  const [code, setCode] = useState(null);

  useEffect(() => {
    setCode(normaliserCode(new URLSearchParams(window.location.search).get("code")));
  }, []);

  if (code === null) return null;
  return <ScategoriesJoueur codeInitial={code} onQuitter={() => router.push("/scategories")} />;
}
