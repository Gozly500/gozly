"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function HoraireJourWidget({ entrepriseId }) {
  const [quarts, setQuarts] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const date = todayISO();
    Promise.all([
      supabase
        .from("planning_quarts")
        .select("*")
        .eq("entreprise_id", entrepriseId)
        .eq("date", date)
        .order("heure_debut", { ascending: true }),
      supabase.from("employes").select("*").eq("entreprise_id", entrepriseId),
    ]).then(([quartsRes, employesRes]) => {
      setQuarts(quartsRes.data || []);
      setEmployes(employesRes.data || []);
      setLoading(false);
    });
  }, [entrepriseId]);

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  if (quarts.length === 0) {
    return <p className="widget-card-empty">Personne de planifié aujourd'hui.</p>;
  }

  const nomEmploye = (id) => employes.find((e) => e.id === id)?.nom || "—";

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Employé</th>
              <th>Début</th>
              <th>Fin</th>
            </tr>
          </thead>
          <tbody>
            {quarts.map((q) => (
              <tr key={q.id}>
                <td>{nomEmploye(q.employe_id)}</td>
                <td>{q.heure_debut.slice(0, 5)}</td>
                <td>{q.heure_fin.slice(0, 5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link href="/dashboard/horaire" className="admin-icon-btn" style={{ display: "inline-block", marginTop: "14px" }}>
        Voir l'Horaire →
      </Link>
    </>
  );
}
