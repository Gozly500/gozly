"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function JourEditor({ entrepriseId, date }) {
  const [categories, setCategories] = useState([]);
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null);
  const [texte, setTexte] = useState("");

  useEffect(() => {
    load();
  }, [entrepriseId, date]);

  async function load() {
    setLoading(true);
    const { data: categoriesData } = await supabase
      .from("categories")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true });

    const { data: tachesData } = await supabase
      .from("taches")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .eq("date", date)
      .order("created_at", { ascending: true });

    setCategories(categoriesData || []);
    setTaches(tachesData || []);
    setLoading(false);
  }

  async function handleAdd(categorieId, e) {
    e.preventDefault();
    if (!texte.trim()) return;

    await supabase.from("taches").insert({
      entreprise_id: entrepriseId,
      categorie_id: categorieId,
      date,
      texte: texte.trim(),
    });
    setTexte("");
    setAddingFor(null);
    load();
  }

  async function handleToggle(tache) {
    setTaches((prev) => prev.map((t) => (t.id === tache.id ? { ...t, terminee: !t.terminee } : t)));
    await supabase.from("taches").update({ terminee: !tache.terminee }).eq("id", tache.id);
  }

  async function handleDelete(id) {
    await supabase.from("taches").delete().eq("id", id);
    load();
  }

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2 style={{ textTransform: "capitalize" }}>{dateLabel}</h2>
      <p className="panel-hint">Les tâches à faire ce jour-là, par catégorie.</p>

      {categories.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>
          Aucune catégorie pour l'instant.{" "}
          <Link href="/dashboard/planning/categories" style={{ textDecoration: "underline", color: "#fff" }}>
            Crée-en une
          </Link>{" "}
          pour pouvoir ajouter des tâches.
        </p>
      ) : (
        <div className="planning-days">
          {categories.map((cat) => {
            const catTaches = taches.filter((t) => t.categorie_id === cat.id);
            return (
              <div className="planning-day" key={cat.id}>
                <div className="planning-day-head">
                  <span className="planning-day-title">{cat.nom}</span>
                  <button className="admin-icon-btn" onClick={() => setAddingFor(cat.id)}>
                    + Ajouter une tâche
                  </button>
                </div>

                {catTaches.map((t) => (
                  <label className="planning-tache" key={t.id}>
                    <input type="checkbox" checked={t.terminee} onChange={() => handleToggle(t)} />
                    <span className={`planning-tache-texte${t.terminee ? " done" : ""}`}>{t.texte}</span>
                    <button
                      type="button"
                      className="admin-icon-btn danger"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(t.id);
                      }}
                    >
                      Retirer
                    </button>
                  </label>
                ))}

                {catTaches.length === 0 && addingFor !== cat.id && (
                  <p style={{ color: "var(--text-dim)", fontSize: "13px" }}>Aucune tâche.</p>
                )}

                {addingFor === cat.id && (
                  <form className="admin-add-form" onSubmit={(e) => handleAdd(cat.id, e)} style={{ maxWidth: "none" }}>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Décris la tâche"
                      value={texte}
                      onChange={(e) => setTexte(e.target.value)}
                    />
                    <button type="submit" className="btn-small">
                      Ajouter
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => {
                        setAddingFor(null);
                        setTexte("");
                      }}
                    >
                      Annuler
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
