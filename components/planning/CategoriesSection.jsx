"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { NOM_CATEGORIE_COMMANDES } from "@/lib/commandes";

// Liste des tâches "modèles" d'une catégorie (ex: les sortes de pizza) -
// repliée sous chaque catégorie, voir JourEditor.jsx pour leur utilisation
// au moment de créer la journée.
function ModelesSection({ entrepriseId, categorieId }) {
  const [modeles, setModeles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, [categorieId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("taches_modeles")
      .select("*")
      .eq("categorie_id", categorieId)
      .order("created_at", { ascending: true });
    setModeles(data || []);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    setError(null);
    const { error: insertError } = await supabase
      .from("taches_modeles")
      .insert({ entreprise_id: entrepriseId, categorie_id: categorieId, nom: nom.trim() });
    if (insertError) {
      console.error("Erreur ajout tâche modèle:", insertError);
      setError(insertError.message || "L'ajout a échoué.");
      return;
    }
    setNom("");
    load();
  }

  async function handleDelete(id) {
    await supabase.from("taches_modeles").delete().eq("id", id);
    load();
  }

  return (
    <div style={{ padding: "4px 20px 16px" }}>
      <p className="section-hint" style={{ marginBottom: "10px" }}>
        Les tâches qui reviennent chaque jour dans cette catégorie (ex: les sortes de pizza) - elles apparaîtront
        toutes prêtes, avec juste une courte note ou une quantité à écrire, quand tu crées une journée.
      </p>
      {!loading && modeles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
          {modeles.map((m) => (
            <span key={m.id} className="admin-status-pill" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {m.nom}
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                style={{ background: "none", border: "none", padding: 0, color: "inherit", cursor: "pointer", fontSize: "13px" }}
                title="Retirer"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <form className="admin-add-form" onSubmit={handleAdd} style={{ maxWidth: "none" }}>
        <input type="text" placeholder="Ex: Pizza Margherita" value={nom} onChange={(e) => setNom(e.target.value)} required />
        <button type="submit" className="btn-small">
          Ajouter
        </button>
      </form>
      {error && <p className="settings-msg err">{error}</p>}
    </div>
  );
}

export default function CategoriesSection({ entrepriseId }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editNom, setEditNom] = useState("");
  const [modelesOuvertId, setModelesOuvertId] = useState(null);
  // Pour animer le déplacement d'une catégorie : on retient la position de chaque
  // ligne avant le changement, puis on la fait glisser de l'ancienne à la nouvelle.
  const lignesRef = useRef(new Map());
  const positionsAvantRef = useRef(null);

  useLayoutEffect(() => {
    const avant = positionsAvantRef.current;
    if (!avant) return;
    positionsAvantRef.current = null;
    for (const [id, el] of lignesRef.current) {
      const precedent = avant.get(id);
      if (precedent == null) continue;
      const ecart = precedent - el.getBoundingClientRect().top;
      if (!ecart) continue;
      el.style.transition = "none";
      el.style.transform = `translateY(${ecart}px)`;
      el.getBoundingClientRect(); // force le recalcul avant de lancer la transition
      el.style.transition = "transform 280ms ease";
      el.style.transform = "";
    }
  }, [categories]);

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("ordre", { ascending: true })
      .order("created_at", { ascending: true });
    setCategories(data || []);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    // Une nouvelle catégorie se place à la fin de la liste.
    const dernierOrdre = categories.reduce((max, c) => Math.max(max, c.ordre || 0), 0);
    await supabase.from("categories").insert({ entreprise_id: entrepriseId, nom: nom.trim(), ordre: dernierOrdre + 1 });
    setNom("");
    load();
  }

  // Monte (-1) ou descend (+1) une catégorie : on renumérote toute la liste
  // (1, 2, 3...) pour ne jamais dépendre d'anciens numéros en double.
  async function deplacer(index, sens) {
    const cible = index + sens;
    if (cible < 0 || cible >= categories.length) return;
    const nouvelle = [...categories];
    [nouvelle[index], nouvelle[cible]] = [nouvelle[cible], nouvelle[index]];
    const avecOrdre = nouvelle.map((c, i) => ({ ...c, ordre: i + 1 }));
    positionsAvantRef.current = new Map([...lignesRef.current].map(([id, el]) => [id, el.getBoundingClientRect().top]));
    setCategories(avecOrdre); // affichage immédiat
    await Promise.all(
      avecOrdre.filter((c, i) => c.id !== categories[i]?.id || c.ordre !== categories[i]?.ordre).map((c) =>
        supabase.from("categories").update({ ordre: c.ordre }).eq("id", c.id)
      )
    );
  }

  function startEdit(cat) {
    setEditingId(cat.id);
    setEditNom(cat.nom);
  }

  async function handleSaveEdit(id) {
    if (!editNom.trim()) return;
    await supabase.from("categories").update({ nom: editNom.trim() }).eq("id", id);
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("categories").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Catégories</h2>
      <p className="panel-hint">Les catégories dans lesquelles tes tâches sont classées (ex: Cuisine, Ménage).</p>

      <div className="admin-list" style={{ marginBottom: "20px", maxWidth: "560px" }}>
        {categories.map((cat, index) => (
          <div
            className="admin-row"
            style={{ flexDirection: "column", alignItems: "stretch" }}
            key={cat.id}
            ref={(el) => {
              if (el) lignesRef.current.set(cat.id, el);
              else lignesRef.current.delete(cat.id);
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              {editingId === cat.id ? (
                <input
                  type="text"
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  style={{ flex: 1 }}
                />
              ) : (
                <div className="admin-row-main">
                  <div className="admin-row-title">
                    {cat.nom}
                    {cat.nom === NOM_CATEGORIE_COMMANDES && <span className="forfait-badge" style={{ padding: "3px 10px", fontSize: "11.5px", marginLeft: "10px" }}>Géré par un module</span>}
                  </div>
                  {cat.nom === NOM_CATEGORIE_COMMANDES && (
                    <div className="admin-row-sub">Remplie automatiquement par le module Commandes en ligne.</div>
                  )}
                </div>
              )}

              <div className="admin-row-controls">
                {cat.nom === NOM_CATEGORIE_COMMANDES ? (
                  <>
                    <button className="admin-icon-btn" onClick={() => deplacer(index, -1)} disabled={index === 0} title="Monter" aria-label="Monter la catégorie">
                      ↑
                    </button>
                    <button
                      className="admin-icon-btn"
                      onClick={() => deplacer(index, 1)}
                      disabled={index === categories.length - 1}
                      title="Descendre"
                      aria-label="Descendre la catégorie"
                    >
                      ↓
                    </button>
                  </>
                ) : editingId === cat.id ? (
                  <>
                    <button className="admin-icon-btn" onClick={() => handleSaveEdit(cat.id)}>
                      Enregistrer
                    </button>
                    <button className="admin-icon-btn" onClick={() => setEditingId(null)}>
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="admin-icon-btn"
                      onClick={() => deplacer(index, -1)}
                      disabled={index === 0}
                      title="Monter"
                      aria-label="Monter la catégorie"
                    >
                      ↑
                    </button>
                    <button
                      className="admin-icon-btn"
                      onClick={() => deplacer(index, 1)}
                      disabled={index === categories.length - 1}
                      title="Descendre"
                      aria-label="Descendre la catégorie"
                    >
                      ↓
                    </button>
                    <button
                      className="admin-icon-btn"
                      onClick={() => setModelesOuvertId((cur) => (cur === cat.id ? null : cat.id))}
                    >
                      {modelesOuvertId === cat.id ? "Fermer" : "Tâches pré-enregistrées"}
                    </button>
                    <button className="admin-icon-btn" onClick={() => startEdit(cat)}>
                      Modifier
                    </button>
                    <button className="admin-icon-btn danger" onClick={() => handleDelete(cat.id)}>
                      Retirer
                    </button>
                  </>
                )}
              </div>
            </div>

            {modelesOuvertId === cat.id && <ModelesSection entrepriseId={entrepriseId} categorieId={cat.id} />}
          </div>
        ))}
        {categories.length === 0 && <div className="admin-empty">Aucune catégorie pour l'instant.</div>}
      </div>

      <form className="admin-add-form" onSubmit={handleAdd}>
        <input type="text" placeholder="Nom de la catégorie" value={nom} onChange={(e) => setNom(e.target.value)} required />
        <button type="submit" className="btn-small">
          Ajouter
        </button>
      </form>
    </div>
  );
}
