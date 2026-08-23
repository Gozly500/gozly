"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";

export default function TachesEmploye() {
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setLoading(true);
    const res = await employeFetch("/api/employe-app/taches");
    const data = await res.json();
    setTaches(data.taches || []);
    setLoading(false);
  }

  async function toggle(tache) {
    setTaches((prev) => prev.map((t) => (t.id === tache.id ? { ...t, terminee: !t.terminee } : t)));
    await employeFetch(`/api/employe-app/taches/${tache.id}`, {
      method: "PATCH",
      body: JSON.stringify({ terminee: !tache.terminee }),
    });
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  if (taches.length === 0) {
    return <p className="chat-empty">Aucune tâche pour aujourd'hui.</p>;
  }

  const categories = [];
  const parCategorie = new Map();
  for (const t of taches) {
    const cle = t.categorie?.id || "sans-categorie";
    if (!parCategorie.has(cle)) {
      parCategorie.set(cle, []);
      categories.push({ id: cle, nom: t.categorie?.nom || "Autres" });
    }
    parCategorie.get(cle).push(t);
  }

  return (
    <div>
      <h2>Tâches</h2>
      <p className="panel-hint">Les tâches à faire aujourd'hui pour ta succursale.</p>

      <div className="planning-days">
        {categories.map((cat) => (
          <div className="planning-day" key={cat.id}>
            <div className="planning-day-head">
              <span className="planning-day-title">{cat.nom}</span>
            </div>
            {parCategorie.get(cat.id).map((t) => (
              <label className="planning-tache" key={t.id}>
                <input type="checkbox" checked={t.terminee} onChange={() => toggle(t)} />
                <span className={`planning-tache-texte${t.terminee ? " done" : ""}`}>{t.texte}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
