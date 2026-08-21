"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PointageSection from "@/components/horaire/PointageSection";

export default function PointageKioskContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [entrepriseNom, setEntrepriseNom] = useState("");

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profil } = await supabase
        .from("profils")
        .select("entreprise_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (ignore) return;

      if (profil?.entreprise_id) {
        setEntrepriseId(profil.entreprise_id);
        const { data: entreprise } = await supabase
          .from("entreprises")
          .select("nom")
          .eq("id", profil.entreprise_id)
          .maybeSingle();
        if (!ignore) setEntrepriseNom(entreprise?.nom || "");
      }

      setChecking(false);
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="kiosk-screen">
      <div className="kiosk-inner">
        {entrepriseNom && <p className="kiosk-entreprise">{entrepriseNom}</p>}
        {entrepriseId ? (
          <PointageSection entrepriseId={entrepriseId} />
        ) : (
          <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
        )}
      </div>
    </div>
  );
}
