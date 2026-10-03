"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { NOM_CATEGORIE_COMMANDES } from "@/lib/commandes";
import { getEmplacementSelectionne, setEmplacementSelectionne } from "@/lib/entreprise";
import EmplacementSelect from "@/components/EmplacementSelect";

export default function JourEditor({ entrepriseId, date, integre = false }) {
  const [categories, setCategories] = useState([]);
  const [taches, setTaches] = useState([]);
  const [modeles, setModeles] = useState([]);
  const [valeursModeles, setValeursModeles] = useState({});
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementIdState] = useState(null);
  const emplacementIdRef = useRef(null);
  emplacementIdRef.current = emplacementId;
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null);
  const [texte, setTexte] = useState("");
  const [modelesPourCategorie, setModelesPourCategorie] = useState(null); // categorie_id dont la popup de modèles est ouverte

  useEffect(() => {
    load();
  }, [entrepriseId, date]);

  // Les employés cochent leurs tâches sur leur téléphone : on relit les tâches toutes les
  // 20 s (page visible) pour voir leur avancement sans recharger la page.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadTaches(emplacementIdRef.current);
    }, 20000);
    return () => clearInterval(id);
  }, [entrepriseId, date]);

  function changerEmplacement(id) {
    setEmplacementIdState(id);
    setEmplacementSelectionne(entrepriseId, id);
    loadTaches(id);
  }

  async function load() {
    setLoading(true);
    const [categoriesRes, emplacementsRes, modelesRes] = await Promise.all([
      supabase.from("categories").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
      supabase.from("emplacements").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
      supabase.from("taches_modeles").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
    ]);

    setCategories(categoriesRes.data || []);
    setModeles(modelesRes.data || []);
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

  async function handleAddDepuisModele(modele) {
    const valeur = (valeursModeles[modele.id] || "").trim();
    await supabase.from("taches").insert({
      entreprise_id: entrepriseId,
      categorie_id: modele.categorie_id,
      date,
      texte: valeur ? `${modele.nom} : ${valeur}` : modele.nom,
      emplacement_id: emplacementId,
    });
    setValeursModeles((prev) => ({ ...prev, [modele.id]: "" }));
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
      {integre ? (
        <p style={{ textTransform: "capitalize", fontWeight: 600, margin: "4px 0 12px" }}>{dateLabel}</p>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ textTransform: "capitalize" }}>{dateLabel}</h2>
            <p className="panel-hint">Les tâches à faire ce jour-là, par catégorie.</p>
          </div>
          <Link href="/dashboard/planning" className="submit-btn" style={{ textDecoration: "none" }}>
            ✓ Terminé
          </Link>
        </div>
      )}

      <EmplacementSelect emplacements={emplacements} value={emplacementId} onChange={changerEmplacement} />

      {categories.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>
          Aucune catégorie pour l'instant.{" "}
          <Link href="/dashboard/planning/categories" style={{ textDecoration: "underline", color: "var(--fg)" }}>
            Crée-en une
          </Link>{" "}
          pour pouvoir ajouter des tâches.
        </p>
      ) : (
        <div className="planning-days">
          {categories.map((cat) => {
            const catTaches = taches.filter((t) => t.categorie_id === cat.id);
            const catModeles = modeles.filter((m) => m.categorie_id === cat.id);
            return (
              <div className="planning-day" key={cat.id}>
                <div className="planning-day-head">
                  <span className="planning-day-title">
                    {cat.nom}
                    {cat.nom === NOM_CATEGORIE_COMMANDES && <span className="forfait-badge" style={{ padding: "3px 10px", fontSize: "11.5px", marginLeft: "10px" }}>Géré par un module</span>}
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {catModeles.length > 0 && (
                      <button className="admin-icon-btn" onClick={() => setModelesPourCategorie(cat.id)}>
                        📋 Modèles
                      </button>
                    )}
                    <button className="admin-icon-btn" onClick={() => setAddingFor(cat.id)}>
                      + Ajouter une tâche
                    </button>
                  </div>
                </div>

                {catTaches.map((t) => (
                  <label className="planning-tache" key={t.id}>
                    <input type="checkbox" checked={t.terminee} onChange={() => handleToggle(t)} />
                    <span className={`planning-tache-texte${t.terminee ? " done" : ""}`}>{t.texte}</span>
                    {t.source !== "commande" && (
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
                    )}
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

      {modelesPourCategorie && (
        <div className="modal-overlay" onClick={() => setModelesPourCategorie(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{categories.find((c) => c.id === modelesPourCategorie)?.nom}</h3>
              <button className="admin-icon-btn" onClick={() => setModelesPourCategorie(null)}>
                Fermer
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {modeles
                .filter((m) => m.categorie_id === modelesPourCategorie)
                .map((m) => (
                  <form
                    key={m.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddDepuisModele(m);
                    }}
                    style={{ display: "flex", gap: "8px", alignItems: "center" }}
                  >
                    <span style={{ fontSize: "13.5px", minWidth: "0", flex: "1 1 40%" }}>{m.nom}</span>
                    <input
                      type="text"
                      placeholder="Quantité ou note"
                      value={valeursModeles[m.id] || ""}
                      onChange={(e) => setValeursModeles((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      style={{ flex: "1 1 auto", minWidth: 0 }}
                    />
                    <button type="submit" className="btn-small">
                      Ajouter
                    </button>
                  </form>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
