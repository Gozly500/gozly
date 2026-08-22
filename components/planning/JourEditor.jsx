"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getEmplacementSelectionne, setEmplacementSelectionne } from "@/lib/entreprise";
import EmplacementSelect from "@/components/EmplacementSelect";

export default function JourEditor({ entrepriseId, date }) {
  const [categories, setCategories] = useState([]);
  const [taches, setTaches] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementIdState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null);
  const [texte, setTexte] = useState("");

  useEffect(() => {
    load();
  }, [entrepriseId, date]);

  function changerEmplacement(id) {
    setEmplacementIdState(id);
    setEmplacementSelectionne(entrepriseId, id);
    loadTaches(id);
  }

  async function load() {
    setLoading(true);
    const [categoriesRes, emplacementsRes] = await Promise.all([
      supabase.from("categories").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
      supabase.from("emplacements").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
    ]);

    setCategories(categoriesRes.data || []);
    const list = emplacementsRes.data || [];
    setEmplacements(list);

    let selected = null;
    if (list.length > 0) {
      const saved = getEmplacementSelectionne(entrepriseId);
      selected = saved && list.some((e) => e.id === saved) ? saved : list[0].id;
      setEmplacementIdState(selected);
    }

    await loadTaches(selected);
    setLoading(false);
  }

  async function loadTaches(filtreEmplacementId) {
    let query = supabase.from("taches").select("*").eq("entreprise_id", entrepriseId).eq("date", date);
    if (filtreEmplacementId) query = query.eq("emplacement_id", filtreEmplacementId);
    const { data } = await query.order("created_at", { ascending: true });
    setTaches(data || []);
  }

  async function handleAdd(categorieId, e) {
    e.preventDefault();
    if (!texte.trim()) return;

    await supabase.from("taches").insert({
      entreprise_id: entrepriseId,
      categorie_id: categorieId,
      date,
      texte: texte.trim(),
      emplacement_id: emplacementId,
    });
    setTexte("");
    setAddingFor(null);
    loadTaches(emplacementId);
  }

  async function handleToggle(tache) {
    setTaches((prev) => prev.map((t) => (t.id === tache.id ? { ...t, terminee: !t.terminee } : t)));
    await supabase.from("taches").update({ terminee: !tache.terminee }).eq("id", tache.id);
  }

  async function handleDelete(id) {
    await supabase.from("taches").delete().eq("id", id);
    loadTaches(emplacementId);
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ textTransform: "capitalize" }}>{dateLabel}</h2>
          <p className="panel-hint">Les tâches à faire ce jour-là, par catégorie.</p>
        </div>
        <Link href="/dashboard/planning" className="submit-btn" style={{ textDecoration: "none" }}>
          ✓ Terminé
        </Link>
      </div>

      <EmplacementSelect emplacements={emplacements} value={emplacementId} onChange={changerEmplacement} />

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
