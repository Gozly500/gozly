"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function formatMontant(n) {
  return n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

export default function VentesWidget({ entrepriseId }) {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    supabase
      .from("ventes")
      .select("montant")
      .eq("entreprise_id", entrepriseId)
      .eq("date", aujourdhui)
      .then(({ data }) => {
        setTotal((data || []).reduce((sum, v) => sum + Number(v.montant), 0));
        setLoading(false);
      });
  }, [entrepriseId]);

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <>
      <p style={{ fontSize: "28px", fontWeight: 700 }}>{formatMontant(total)}</p>
      <p className="section-hint" style={{ marginTop: "-4px" }}>
        Ventes aujourd'hui, toutes sources confondues.
      </p>
      <Link href="/dashboard/ventes" className="admin-icon-btn" style={{ display: "inline-block", marginTop: "10px" }}>
        Voir le suivi des ventes →
      </Link>
    </>
  );
}
