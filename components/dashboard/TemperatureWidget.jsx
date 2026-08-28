"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function TemperatureWidget({ entrepriseId }) {
  const [releves, setReleves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("releves_temperature")
      .select("*, equipement:equipement_id(nom)")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setReleves(data || []);
        setLoading(false);
      });
  }, [entrepriseId]);

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  const nonConformes = releves.filter((r) => !r.conforme);

  if (nonConformes.length === 0) {
    return <p className="widget-card-empty">Aucun relevé hors norme récemment.</p>;
  }

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Équipement</th>
              <th>Température</th>
              <th>Relevé par</th>
            </tr>
          </thead>
          <tbody>
            {nonConformes.slice(0, 5).map((r) => (
              <tr key={r.id}>
                <td>{r.equipement?.nom || "?"}</td>
                <td>⚠️ {r.temperature}°C</td>
                <td>{r.releve_par}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link href="/dashboard/temperature" className="admin-icon-btn" style={{ display: "inline-block", marginTop: "14px" }}>
        Voir le registre →
      </Link>
    </>
  );
}
