"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { creneauActuel } from "@/lib/temperature";

// Une alerte disparaît du widget après ce nombre de jours (le registre complet
// reste dans Températures > Historique).
const JOURS_AFFICHAGE_ALERTES = 3;

function jourMoinsN(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "Aujourd'hui AM", "Hier PM" ou "18 sept. PM" - une alerte sans date pouvait
// passer pour actuelle alors qu'elle date de la veille.
function quand(r, aujourdhui) {
  const periode = r.periode?.toUpperCase() || "";
  const hier = new Date(aujourdhui + "T00:00:00");
  hier.setDate(hier.getDate() - 1);
  const hierStr = `${hier.getFullYear()}-${String(hier.getMonth() + 1).padStart(2, "0")}-${String(hier.getDate()).padStart(2, "0")}`;
  let jour;
  if (r.date_relevee === aujourdhui) jour = "Aujourd'hui";
  else if (r.date_relevee === hierStr) jour = "Hier";
  else jour = new Date(r.date_relevee + "T00:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
  return `${jour} ${periode}`.trim();
}

export default function TemperatureWidget({ entrepriseId }) {
  const [releves, setReleves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("releves_temperature")
      .select("*, equipement:equipement_id(nom)")
      .eq("entreprise_id", entrepriseId)
      .eq("conforme", false)
      .gte("date_relevee", jourMoinsN(creneauActuel().date, JOURS_AFFICHAGE_ALERTES))
      .order("date_relevee", { ascending: false })
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
  const aujourdhui = creneauActuel().date;

  if (nonConformes.length === 0) {
    return <p className="widget-card-empty">Aucun relevé hors norme dans les 3 derniers jours.</p>;
  }

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Équipement</th>
              <th>Quand</th>
              <th>Température</th>
              <th>Relevé par</th>
            </tr>
          </thead>
          <tbody>
            {nonConformes.slice(0, 5).map((r) => (
              <tr key={r.id}>
                <td>{r.equipement?.nom || "?"}</td>
                <td>{quand(r, aujourdhui)}</td>
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
