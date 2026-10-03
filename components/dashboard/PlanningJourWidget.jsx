"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PlanningJourWidget({ entrepriseId }) {
  const [taches, setTaches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const date = todayISO();
    Promise.all([
      supabase.from("taches").select("*").eq("entreprise_id", entrepriseId).eq("date", date).order("created_at", { ascending: true }),
      supabase.from("categories").select("*").eq("entreprise_id", entrepriseId).order("ordre", { ascending: true }).order("created_at", { ascending: true }),
    ]).then(([tachesRes, categoriesRes]) => {
      setTaches(tachesRes.data || []);
      setCategories(categoriesRes.data || []);
      setLoading(false);
    });
  }, [entrepriseId]);

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  if (taches.length === 0) {
    return <p className="widget-card-empty">Aucune tâche prévue aujourd'hui.</p>;
  }

  const nomCategorie = (id) => categories.find((c) => c.id === id)?.nom;

  // Le widget reste court : 8 tâches au maximum, les "à faire" d'abord (pour ne
  // pas cacher ce qui reste derrière des tâches déjà faites). Le reste est sur la page Tâches.
  const MAX_TACHES = 8;
  const triees = [...taches.filter((t) => !t.terminee), ...taches.filter((t) => t.terminee)];
  const rangCategorie = (id) => {
    const i = categories.findIndex((c) => c.id === id);
    return i === -1 ? 9999 : i;
  };
  // Les 8 tâches retenues (les "à faire" d'abord) sont présentées dans l'ordre des catégories.
  const affichees = triees.slice(0, MAX_TACHES).sort((a, b) => rangCategorie(a.categorie_id) - rangCategorie(b.categorie_id));
  const masquees = triees.length - affichees.length;

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tâche</th>
              <th>Catégorie</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {affichees.map((t) => (
              <tr key={t.id}>
                <td>{t.texte}</td>
                <td>{nomCategorie(t.categorie_id) || "—"}</td>
                <td>{t.terminee ? "✅ Faite" : "À faire"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {masquees > 0 && (
        <p style={{ color: "var(--text-dim)", fontSize: "13px", marginTop: "10px" }}>
          + {masquees} autre{masquees > 1 ? "s" : ""} tâche{masquees > 1 ? "s" : ""}
        </p>
      )}
      <Link href="/dashboard/planning" className="admin-icon-btn" style={{ display: "inline-block", marginTop: "14px" }}>
        Voir les tâches →
      </Link>
    </>
  );
}
