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
      supabase.from("categories").select("*").eq("entreprise_id", entrepriseId),
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
            {taches.map((t) => (
              <tr key={t.id}>
                <td>{t.texte}</td>
                <td>{nomCategorie(t.categorie_id) || "—"}</td>
                <td>{t.terminee ? "✅ Faite" : "À faire"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link href="/dashboard/planning" className="admin-icon-btn" style={{ display: "inline-block", marginTop: "14px" }}>
        Voir le Planning →
      </Link>
    </>
  );
}
