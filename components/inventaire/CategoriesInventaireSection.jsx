"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { IconFlecheBas, IconFlecheHaut } from "@/components/icons/Pictogrammes";

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

  // Animation du déplacement (comme les catégories de tâches) : on retient la position de chaque
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

  // Monte (-1) ou descend (+1) une catégorie : on renumérote toute la liste (1, 2, 3...)
  // pour ne jamais dépendre d'anciens numéros en double.
  async function deplacer(index, sens) {
    const cible = index + sens;
    if (cible < 0 || cible >= categories.length) return;
    const nouvelle = [...categories];
    [nouvelle[index], nouvelle[cible]] = [nouvelle[cible], nouvelle[index]];
    const avecOrdre = nouvelle.map((c, i) => ({ ...c, ordre: i + 1 }));
    positionsAvantRef.current = new Map([...lignesRef.current].map(([id, el]) => [id, el.getBoundingClientRect().top]));
    setCategories(avecOrdre); // affichage immédiat, avec l'animation
    await Promise.all(
      avecOrdre
        .filter((c, i) => c.id !== categories[i]?.id || c.ordre !== categories[i]?.ordre)
        .map((c) => supabase.from("categories_inventaire").update({ ordre: c.ordre }).eq("id", c.id))
    );
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
          <div
            className="admin-row"
            key={c.id}
            ref={(el) => {
              if (el) lignesRef.current.set(c.id, el);
              else lignesRef.current.delete(c.id);
            }}
          >
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
                <IconFlecheHaut className="gozly-icon" />
              </button>
              <button className="admin-icon-btn" disabled={i === categories.length - 1} onClick={() => deplacer(i, 1)} aria-label="Descendre">
                <IconFlecheBas className="gozly-icon" />
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
