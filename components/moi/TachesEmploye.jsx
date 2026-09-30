"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";

export default function TachesEmploye() {
  const { t } = useLangue();
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
    setTaches((prev) => prev.map((tk) => (tk.id === tache.id ? { ...tk, terminee: !tk.terminee } : tk)));
    await employeFetch(`/api/employe-app/taches/${tache.id}`, {
      method: "PATCH",
      body: JSON.stringify({ terminee: !tache.terminee }),
    });
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>{t("nav.chargement")}</p>;
  }

  if (taches.length === 0) {
    return <p className="chat-empty">{t("taches.aucune")}</p>;
  }

  const categories = [];
  const parCategorie = new Map();
  for (const tache of taches) {
    const cle = tache.categorie?.id || "sans-categorie";
    if (!parCategorie.has(cle)) {
      parCategorie.set(cle, []);
      categories.push({ id: cle, nom: tache.categorie?.nom || t("taches.autres") });
    }
    parCategorie.get(cle).push(tache);
  }

  return (
    <div>
      <h2>{t("taches.titre")}</h2>
      <p className="panel-hint">{t("taches.hint")}</p>

      <div className="planning-days">
        {categories.map((cat) => (
          <div className="planning-day" key={cat.id}>
            <div className="planning-day-head">
              <span className="planning-day-title">{cat.nom}</span>
            </div>
            {parCategorie.get(cat.id).map((tache) => (
              <label className="planning-tache" key={tache.id}>
                <input type="checkbox" checked={tache.terminee} onChange={() => toggle(tache)} />
                <span className={`planning-tache-texte${tache.terminee ? " done" : ""}`}>{tache.texte}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
