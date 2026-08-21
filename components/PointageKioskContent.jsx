"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PointageSection from "@/components/horaire/PointageSection";
import { resoudreEntrepriseActive } from "@/lib/entreprise";

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

      const { entrepriseId: eid, besoinChoix, invitationsEnAttente } = await resoudreEntrepriseActive(supabase);
      if (ignore) return;

      if (invitationsEnAttente > 0) {
        router.push("/invitations");
        return;
      }

      if (besoinChoix) {
        router.push("/dashboards");
        return;
      }

      if (eid) {
        setEntrepriseId(eid);
        const { data: entreprise } = await supabase.from("entreprises").select("nom").eq("id", eid).maybeSingle();
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
