"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Catégories de produits de l'Inventaire : créer, renommer, ordonner (▲▼) et retirer.
// Retirer une catégorie ne supprime pas ses produits : ils passent « Sans catégorie ».
export default function CategoriesInventaireSection({ entrepriseId }) {
  const [categories, setCategories] = useState([]);
  const [produits, setProduits] = useState([]); // seulement pour compter les produits de chaque catégorie
  const [loading, setLoading] = useState(true);
  const [nouvelle, setNouvelle] = useState("");
  const [renommerId, setRenommerId] = useState(null);
  const [renommerNom, setRenommerNom] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    const [{ data: cats, error }, { data: prods }] = await Promise.all([
      supabase.from("categories_inventaire").select("*").eq("entreprise_id", entrepriseId).order("ordre", { ascending: true }).order("created_at", { ascending: true }),
      supabase.from("produits_inventaire").select("id, categorie_id").eq("entreprise_id", entrepriseId),
    ]);
    if (error) setErreur("Les catégories ne sont pas prêtes. As-tu exécuté inventaire_categories.sql dans Supabase?");
    setCategories(cats || []);
    setProduits(prods || []);
    setLoading(false);
  }

  async function ajouter(e) {
    e.preventDefault();
    const nom = nouvelle.trim();
    if (!nom) return;
    setErreur("");
    const ordre = categories.reduce((max, c) => Math.max(max, c.ordre || 0), 0) + 1;
    const { error } = await supabase.from("categories_inventaire").insert({ entreprise_id: entrepriseId, nom, ordre });
    if (error) {
      setErreur("Impossible d'ajouter la catégorie. As-tu exécuté inventaire_categories.sql dans Supabase?");
      return;
    }
    setNouvelle("");
    load();
  }

  async function renommer(id) {
    const nom = renommerNom.trim();
    if (!nom) return;
    await supabase.from("categories_inventaire").update({ nom }).eq("id", id);
    setRenommerId(null);
    load();
  }

  async function retirer(c) {
    const nb = produits.filter((p) => p.categorie_id === c.id).length;
    const confirmation = nb > 0 ? `Retirer « ${c.nom} »? Ses ${nb} produit(s) passeront dans « Sans catégorie ».` : `Retirer « ${c.nom} »?`;
    if (!window.confirm(confirmation)) return;
    await supabase.from("categories_inventaire").delete().eq("id", c.id);
    load();
  }

  // Échange la place de deux catégories voisines (les ordres sont renumérotés 1..n).
  async function deplacer(index, delta) {
    const autre = categories[index + delta];
    const courante = categories[index];
    if (!autre || !courante) return;
    const nouvelleListe = [...categories];
    nouvelleListe[index] = autre;
    nouvelleListe[index + delta] = courante;
    setCategories(nouvelleListe);
    await Promise.all(nouvelleListe.map((c, i) => supabase.from("categories_inventaire").update({ ordre: i + 1 }).eq("id", c.id)));
    load();
  }

  if (loading) return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;

  return (
    <div>
      <h2>Catégories</h2>
      <p className="panel-hint">Classe tes produits par catégorie (ex: Boissons, Desserts). Tu choisis la catégorie de chaque produit dans l&apos;onglet Produits.</p>

      <form onSubmit={ajouter} style={{ display: "flex", gap: "8px", marginBottom: "16px", maxWidth: "520px" }}>
        <input
          type="text"
          value={nouvelle}
          onChange={(e) => setNouvelle(e.target.value)}
          placeholder="Nouvelle catégorie (ex: Boissons)"
          maxLength={60}
          style={{ flex: 1, minWidth: 0, margin: 0 }}
        />
        <button type="submit" className="submit-btn" disabled={!nouvelle.trim()}>
          Ajouter
        </button>
      </form>
      {erreur && <p className="settings-msg err">{erreur}</p>}

      <div className="admin-list" style={{ maxWidth: "720px" }}>
        {categories.length === 0 && <div className="admin-empty">Aucune catégorie pour l&apos;instant.</div>}
        {categories.map((c, i) => (
          <div className="admin-row" key={c.id}>
            <div className="admin-row-main">
              {renommerId === c.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    renommer(c.id);
                  }}
                  style={{ display: "flex", gap: "6px" }}
                >
                  <input type="text" value={renommerNom} onChange={(e) => setRenommerNom(e.target.value)} maxLength={60} autoFocus style={{ flex: 1, minWidth: 0, margin: 0 }} />
                  <button type="submit" className="admin-icon-btn">
                    OK
                  </button>
                </form>
              ) : (
                <>
                  <div className="admin-row-title">{c.nom}</div>
                  <div className="admin-row-sub">{produits.filter((p) => p.categorie_id === c.id).length} produit(s)</div>
                </>
              )}
            </div>
            <div className="admin-row-controls" style={{ gap: "6px" }}>
              <button className="admin-icon-btn" disabled={i === 0} onClick={() => deplacer(i, -1)} aria-label="Monter">
                ▲
              </button>
              <button className="admin-icon-btn" disabled={i === categories.length - 1} onClick={() => deplacer(i, 1)} aria-label="Descendre">
                ▼
              </button>
              <button
                className="admin-icon-btn"
                onClick={() => {
                  setRenommerId(c.id);
                  setRenommerNom(c.nom);
                }}
              >
                Renommer
              </button>
              <button className="admin-icon-btn danger" onClick={() => retirer(c)}>
                Retirer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
