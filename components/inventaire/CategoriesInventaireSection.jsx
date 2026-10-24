"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ListeReordonnable from "@/components/ListeReordonnable";
import { useT } from "@/components/LangProvider";

// Catégories de produits de l'Inventaire : créer, renommer, ordonner (▲▼) et retirer.
// Retirer une catégorie ne supprime pas ses produits : ils passent « Sans catégorie ».
export default function CategoriesInventaireSection({ entrepriseId }) {
  const { t } = useT();
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
    if (error) setErreur(t("Les catégories ne sont pas prêtes. As-tu exécuté inventaire_categories.sql dans Supabase?"));
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
      setErreur(t("Impossible d'ajouter la catégorie. As-tu exécuté inventaire_categories.sql dans Supabase?"));
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

  // Après un glisser-déposer : on renumérote toute la liste (1, 2, 3...) pour ne jamais dépendre d’anciens numéros en double.
  async function reordonner(nouvelle) {
    const avecOrdre = nouvelle.map((c, i) => ({ ...c, ordre: i + 1 }));
    setCategories(avecOrdre); // affichage immédiat
    await Promise.all(
      avecOrdre
        .filter((c, i) => c.id !== categories[i]?.id || c.ordre !== categories[i]?.ordre)
        .map((c) => supabase.from("categories_inventaire").update({ ordre: c.ordre }).eq("id", c.id))
    );
  }

  if (loading) return <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>;

  return (
    <div>
      <h2>{t("Catégories")}</h2>
      <p className="panel-hint">{t("Classe tes produits par catégorie (ex: Boissons, Desserts). Tu choisis la catégorie de chaque produit dans l'onglet Produits.")}</p>

      <form onSubmit={ajouter} style={{ display: "flex", gap: "8px", marginBottom: "16px", maxWidth: "520px" }}>
        <input
          type="text"
          value={nouvelle}
          onChange={(e) => setNouvelle(e.target.value)}
          placeholder={t("Nouvelle catégorie (ex: Boissons)")}
          maxLength={60}
          style={{ flex: 1, minWidth: 0, margin: 0 }}
        />
        <button type="submit" className="submit-btn" disabled={!nouvelle.trim()}>
          {t("Ajouter")}
        </button>
      </form>
      {erreur && <p className="settings-msg err">{erreur}</p>}

      <ListeReordonnable
        className="admin-list"
        style={{ maxWidth: "720px" }}
        items={categories}
        getId={(c) => c.id}
        onReorder={reordonner}
        renderItem={(c, i, g) => (
          <div className="admin-row" key={c.id} ref={g.ref} style={g.style}>
            {g.poignee}
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
                    {t("OK")}
                  </button>
                </form>
              ) : (
                <>
                  <div className="admin-row-title">{c.nom}</div>
                  <div className="admin-row-sub">{produits.filter((p) => p.categorie_id === c.id).length}{" "}{t("produit(s)")}</div>
                </>
              )}
            </div>
            <div className="admin-row-controls" style={{ gap: "6px" }}>
              <button
                className="admin-icon-btn"
                onClick={() => {
                  setRenommerId(c.id);
                  setRenommerNom(c.nom);
                }}
              >
                {t("Renommer")}
              </button>
              <button className="admin-icon-btn danger" onClick={() => retirer(c)}>
                {t("Retirer")}
              </button>
            </div>
          </div>
        )}
      >
        {categories.length === 0 && <div className="admin-empty">{t("Aucune catégorie pour l'instant.")}</div>}
      </ListeReordonnable>
    </div>
  );
}
