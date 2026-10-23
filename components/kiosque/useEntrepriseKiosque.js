"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";

// Entreprise active de la tablette et ses modules actifs (null tant que ce n'est pas lu).
export function useEntrepriseKiosque() {
  const [etat, setEtat] = useState({ entrepriseId: null, modules: [] });

  useEffect(() => {
    let ignore = false;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session || ignore) return;
      const { entrepriseId } = await resoudreEntrepriseActive(supabase);
      if (!entrepriseId || ignore) return;
      const { data } = await supabase.from("modules_actifs").select("module").eq("entreprise_id", entrepriseId);
      if (!ignore) setEtat({ entrepriseId, modules: (data || []).map((m) => m.module) });
    });
    return () => {
      ignore = true;
    };
  }, []);

  return etat;
}
