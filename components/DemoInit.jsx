"use client";

import { useEffect } from "react";
import { demoActif } from "@/lib/demo/actif";
import { chargerDemo } from "@/lib/supabaseClient";

// Au démarrage de n'importe quelle page : si la démo est active dans cet onglet, on charge tout de suite son code
// (moteur, données, fausses routes /api). Sinon, ne fait strictement rien (aucun code de démo n'est téléchargé).
export default function DemoInit() {
  useEffect(() => {
    if (demoActif()) chargerDemo();
  }, []);
  return null;
}
