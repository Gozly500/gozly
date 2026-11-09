"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { definirForfaits } from "@/lib/modules";

// Charge les forfaits (table `forfaits`, gérée depuis Admin > Abonnements) une fois par chargement de page et les met dans le
// registre de lib/modules.js. Tant que la table n'existe pas (SQL pas exécuté) ou n'est pas encore lue, les valeurs d'origine
// du code servent. Les composants qui affichent une limite ou un nom de forfait appellent useForfaits() pour se
// redessiner dès que les forfaits sont là.
let promesse = null;
const ecouteurs = new Set();

async function charger() {
  if (promesse) return promesse;
  promesse = (async () => {
    try {
      const { data, error } = await supabase.from("forfaits").select("*");
      if (!error && data) definirForfaits(data);
    } catch {}
    ecouteurs.forEach((f) => f());
  })();
  return promesse;
}

// À appeler après une modification dans Admin > Abonnements.
export function rechargerForfaits() {
  promesse = null;
  return charger();
}

export function useForfaits() {
  const [, redessiner] = useState(0);
  useEffect(() => {
    const f = () => redessiner((n) => n + 1);
    ecouteurs.add(f);
    charger();
    return () => ecouteurs.delete(f);
  }, []);
}
