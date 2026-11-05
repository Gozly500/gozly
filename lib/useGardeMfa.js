"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Double authentification : un compte qui l'a activée doit avoir passé le code pour que sa session compte. Une session « à demi »
// (ex: ouverte par un lien de réinitialisation du mot de passe) est fermée et renvoyée à la connexion, où le code est demandé.
export async function sessionDemandeCode() {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

export function useGardeMfa() {
  const router = useRouter();
  useEffect(() => {
    let ignore = false;
    sessionDemandeCode()
      .then(async (demande) => {
        if (!demande || ignore) return;
        await supabase.auth.signOut({ scope: "local" });
        router.replace(`/login?retour=${encodeURIComponent(window.location.pathname)}`);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);
}
