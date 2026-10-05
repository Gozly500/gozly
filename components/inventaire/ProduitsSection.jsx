"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { IconIntegration } from "@/components/icons/GozlyIcons";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";

const FORM_VIDE = { nom: "", sku: "", quantite: "", seuilAlerte: "", prix: "", notes: "", categorieId: "" };

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// Menu déroulant maison (pas de <select> natif : il reste blanc dans le thème sombre).
// options : [{ id, nom }] ; la valeur "" est permise (ex: « Sans catégorie »).
function MenuChoix({ options, value, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);
  useFermerAuClicExterieur(ref, ouvert, () => setOuvert(false));
  const courant = options.find((o) => o.id === value) || options[0];
  return (
    <div className="emplacement-select-wrap" ref={ref} style={{ marginBottom: 0 }}>
      <div className={`emplacement-select-trigger${ouvert ? " open" : ""}`} onClick={() => setOuvert((v) => !v)}>
        <span>{courant?.nom}</span>
        <span className="fs-arrow">▾</span>
      </div>
      {ouvert && (
        <div className="emplacement-select-options" style={{ maxHeight: "260px", overflowY: "auto" }}>
          {options.map((o) => (
            <div
              key={o.id}
              className={`emplacement-select-option${o.id === value ? " active" : ""}`}
              onClick={() => {
                onChange(o.id);
                setOuvert(false);
              }}
            >
              {o.nom}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProduitsSection({ entrepriseId }) {
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wixConnecte, setWixConnecte] = useState(false);
  const [wixPushAuto, setWixPushAuto] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [pushingId, setPushingId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VIDE);
  const [saving, setSaving] = useState(false);

  // Catégories de produits. categoriesPretes = la table existe (inventaire_categories.sql exécuté).
  const [categories, setCategories] = useState([]);
  const [categoriesPretes, setCategoriesPretes] = useState(false);
  const [filtreCategorie, setFiltreCategorie] = useState("toutes"); // "toutes" | "sans" | id
  const [gererOuvert, setGererOuvert] = useState(false);
  const [nouvelleCat, setNouvelleCat] = useState("");
  const [renommerId, setRenommerId] = useState(null);
  const [renommerNom, setRenommerNom] = useState("");
  const [catErreur, setCatErreur] = useState("");

  useEffect(() => {
    load();
    authHeaders().then((headers) =>
      fetch(`/api/wix/statut?entrepriseId=${entrepriseId}`, { headers })
        .then((res) => res.json())
        .then((data) => setWixConnecte(!!data.connecte))
        .catch(() => setWixConnecte(false))
    );
    supabase
      .from("entreprises")
      .select("sync_produits_auto")
      .eq("id", entrepriseId)
      .maybeSingle()
      .then(({ data }) => setWixPushAuto(!!data?.sync_produits_auto));
  }, [entrepriseId]);

  async function pousserVersWix(produitId) {
    setPushingId(produitId);
    try {
      const res = await fetch("/api/inventaire/pousser-wix", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ produitId, entrepriseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncMsg({ type: "err", text: data.error || "L'envoi vers Wix a échoué." });
      }
    } catch {
      setSyncMsg({ type: "err", text: "L'envoi vers Wix a échoué." });
    }
    setPushingId(null);
  }

  async function handleSyncWix() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/inventaire/synchroniser-wix", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncMsg({ type: "err", text: data.error || "La synchronisation a échoué." });
      } else {
        setSyncMsg({ type: "ok", text: `${data.count} produit(s) synchronisé(s) depuis Wix.` });
        load();
      }
    } catch {
      setSyncMsg({ type: "err", text: "La synchronisation a échoué." });
    }
    setSyncing(false);
  }

  async function chargerCategories() {
    const { data, error } = await supabase
      .from("categories_inventaire")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("ordre", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      setCategoriesPretes(false);
      setCategories([]);
      return;
    }
    setCategoriesPretes(true);
    setCategories(data || []);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("produits_inventaire")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true });
    setProduits(data || []);
    await chargerCategories();
    setLoading(false);
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...FORM_VIDE, categorieId: categories.some((c) => c.id === filtreCategorie) ? filtreCategorie : "" });
    setModalOpen(true);
  }

  function openEdit(produit) {
    setEditingId(produit.id);
    setForm({
      nom: produit.nom,
      sku: produit.sku || "",
      quantite: String(produit.quantite),
      seuilAlerte: String(produit.seuil_alerte),
      prix: produit.prix != null ? String(produit.prix) : "",
      notes: produit.notes || "",
      categorieId: produit.categorie_id || "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nom.trim()) return;
    setSaving(true);

    const valeurs = {
      nom: form.nom.trim(),
      sku: form.sku.trim() || null,
      quantite: Number(form.quantite) || 0,
      seuil_alerte: Number(form.seuilAlerte) || 0,
      prix: Number.isFinite(parseFloat(String(form.prix).replace(",", "."))) ? parseFloat(String(form.prix).replace(",", ".")) : null,
      notes: form.notes.trim() || null,
      // Seulement si les catégories existent (la colonne vient de inventaire_categories.sql).
      ...(categoriesPretes ? { categorie_id: form.categorieId || null } : {}),
    };

    if (editingId) {
      await supabase.from("produits_inventaire").update({ ...valeurs, updated_at: new Date().toISOString() }).eq("id", editingId);
      const produit = produits.find((p) => p.id === editingId);
      if (wixPushAuto && produit?.source === "wix") pousserVersWix(editingId);
    } else {
      await supabase.from("produits_inventaire").insert({ entreprise_id: entrepriseId, ...valeurs });
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("produits_inventaire").delete().eq("id", id);
    load();
  }

  // ---------- Gestion des catégories ----------
  async function ajouterCategorie(e) {
    e.preventDefault();
    const nom = nouvelleCat.trim();
    if (!nom) return;
    setCatErreur("");
    const ordre = categories.reduce((max, c) => Math.max(max, c.ordre || 0), 0) + 1;
    const { error } = await supabase.from("categories_inventaire").insert({ entreprise_id: entrepriseId, nom, ordre });
    if (error) {
      setCatErreur("Impossible d'ajouter la catégorie. As-tu exécuté inventaire_categories.sql dans Supabase?");
      return;
    }
    setNouvelleCat("");
    chargerCategories();
  }

  async function renommerCategorie(id) {
    const nom = renommerNom.trim();
    if (!nom) return;
    await supabase.from("categories_inventaire").update({ nom }).eq("id", id);
    setRenommerId(null);
    chargerCategories();
  }

  async function supprimerCategorie(c) {
    const nb = produits.filter((p) => p.categorie_id === c.id).length;
    const confirmation = nb > 0 ? `Supprimer « ${c.nom} »? Ses ${nb} produit(s) passeront dans « Sans catégorie ».` : `Supprimer « ${c.nom} »?`;
    if (!window.confirm(confirmation)) return;
    await supabase.from("categories_inventaire").delete().eq("id", c.id);
    if (filtreCategorie === c.id) setFiltreCategorie("toutes");
    load();
  }

  // Échange la place de deux catégories voisines.
  async function deplacerCategorie(index, delta) {
    const autre = categories[index + delta];
    const courante = categories[index];
    if (!autre || !courante) return;
    // Les ordres sont renumérotés 1..n pour éviter les égalités.
    const nouvelle = [...categories];
    nouvelle[index] = autre;
    nouvelle[index + delta] = courante;
    await Promise.all(nouvelle.map((c, i) => supabase.from("categories_inventaire").update({ ordre: i + 1 }).eq("id", c.id)));
    chargerCategories();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  // ---------- Affichage groupé par catégorie ----------
  const appartient = (p, c) => p.categorie_id === c.id;
  const sansCategorie = (p) => !p.categorie_id || !categories.some((c) => c.id === p.categorie_id);

  const groupes =
    categoriesPretes && categories.length > 0
      ? [
          ...categories.map((c) => ({ id: c.id, nom: c.nom, produits: produits.filter((p) => appartient(p, c)) })),
          { id: "sans", nom: "Sans catégorie", produits: produits.filter(sansCategorie) },
        ].filter((g) => g.produits.length > 0 && (filtreCategorie === "toutes" || (filtreCategorie === "sans" ? g.id === "sans" : g.id === filtreCategorie)))
      : [{ id: "tous", nom: null, produits }];

  const optionsFiltre = [
    { id: "toutes", nom: "Toutes les catégories" },
    ...categories.map((c) => ({ id: c.id, nom: c.nom })),
    { id: "sans", nom: "Sans catégorie" },
  ];
  const optionsCategorieProduit = [{ id: "", nom: "Sans catégorie" }, ...categories.map((c) => ({ id: c.id, nom: c.nom }))];

  function ligneProduit(p) {
    const enAlerte = p.quantite <= p.seuil_alerte;
    return (
      <div className="admin-row" key={p.id}>
        <div className="admin-row-main">
          <div className="admin-row-title" style={enAlerte ? { color: "#ff9494" } : undefined}>
            {p.nom} {p.source === "wix" && <IconIntegration className="gozly-icon" />} {enAlerte && "⚠️"}
          </div>
          <div className="admin-row-sub">
            {p.sku && `SKU: ${p.sku} · `}
            Quantité: {p.quantite} · Seuil d'alerte: {p.seuil_alerte}
            {p.prix != null && ` · Prix: ${Number(p.prix).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`}
            {p.notes && ` · ${p.notes}`}
          </div>
        </div>
        <div className="admin-row-controls">
          {p.source === "wix" && !wixPushAuto && (
            <button className="admin-icon-btn" onClick={() => pousserVersWix(p.id)} disabled={pushingId === p.id}>
              {pushingId === p.id ? "..." : <><IconIntegration className="gozly-icon" /> Pousser vers Wix</>}
            </button>
          )}
          <button className="admin-icon-btn" onClick={() => openEdit(p)}>
            Modifier
          </button>
          <button className="admin-icon-btn danger" onClick={() => handleDelete(p.id)}>
            Retirer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <h2>Produits</h2>
          <p className="panel-hint" style={{ marginBottom: 0 }}>
            Tes produits, leurs quantités en stock et leur seuil d'alerte.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {wixConnecte && (
            <button className="admin-icon-btn" onClick={handleSyncWix} disabled={syncing}>
              {syncing ? "Synchronisation..." : <><IconIntegration className="gozly-icon" /> Synchroniser Wix</>}
            </button>
          )}
          <button className="admin-icon-btn" onClick={() => { setCatErreur(""); setGererOuvert(true); }}>
            🏷 Catégories
          </button>
          <button className="submit-btn" onClick={openAdd}>
            + Ajouter un produit
          </button>
        </div>
      </div>

      {syncMsg && <p className={`settings-msg ${syncMsg.type}`}>{syncMsg.text}</p>}

      {categoriesPretes && categories.length > 0 && (
        <div style={{ maxWidth: "320px", marginBottom: "16px" }}>
          <MenuChoix options={optionsFiltre} value={filtreCategorie} onChange={setFiltreCategorie} />
        </div>
      )}

      {produits.length === 0 ? (
        <div className="admin-list" style={{ maxWidth: "900px" }}>
          <div className="admin-empty">Aucun produit pour l'instant.</div>
        </div>
      ) : groupes.length === 0 ? (
        <div className="admin-list" style={{ maxWidth: "900px" }}>
          <div className="admin-empty">Aucun produit dans cette catégorie.</div>
        </div>
      ) : (
        groupes.map((g) => (
          <div key={g.id} style={{ marginBottom: "22px" }}>
            {g.nom && (
              <div className="inventaire-categorie-titre">
                {g.nom} <span>({g.produits.length})</span>
              </div>
            )}
            <div className="admin-list" style={{ maxWidth: "900px" }}>
              {g.produits.map(ligneProduit)}
            </div>
          </div>
        ))
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingId ? "Modifier le produit" : "Ajouter un produit"}</h3>
              <button className="admin-icon-btn" onClick={() => setModalOpen(false)}>
                Fermer
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field-row">
                <div className="field">
                  <label>Nom du produit</label>
                  <input
                    type="text"
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    placeholder="Ex: T-shirt noir M"
                    required
                  />
                </div>
                <div className="field">
                  <label>SKU (optionnel)</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="Ex: TSN-M"
                  />
                </div>
              </div>

              {categoriesPretes && (
                <div className="field">
                  <label>Catégorie</label>
                  <MenuChoix options={optionsCategorieProduit} value={form.categorieId} onChange={(id) => setForm((f) => ({ ...f, categorieId: id }))} />
                  {categories.length === 0 && (
                    <p className="section-hint" style={{ marginTop: "6px" }}>
                      Aucune catégorie pour l'instant : crée-en avec le bouton « Catégories ».
                    </p>
                  )}
                </div>
              )}

              <div className="field-row">
                <div className="field">
                  <label>Quantité</label>
                  <input
                    type="number"
                    value={form.quantite}
                    onChange={(e) => setForm((f) => ({ ...f, quantite: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="field">
                  <label>Seuil d'alerte</label>
                  <input
                    type="number"
                    value={form.seuilAlerte}
                    onChange={(e) => setForm((f) => ({ ...f, seuilAlerte: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="field">
                <label>Prix de vente (optionnel)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.prix}
                  onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                  placeholder="Ex: 12.50 (utilisé pour les commandes manuelles)"
                />
              </div>

              <div className="field">
                <label>Notes (optionnel)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Ex: fournisseur, emplacement en entrepôt..."
                />
              </div>

              <div className="admin-edit-actions">
                <button type="submit" className="submit-btn" disabled={saving}>
                  {saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {gererOuvert && (
        <div className="modal-overlay" onClick={() => setGererOuvert(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Catégories de produits</h3>
              <button className="admin-icon-btn" onClick={() => setGererOuvert(false)}>
                Fermer
              </button>
            </div>

            <form onSubmit={ajouterCategorie} style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <input
                type="text"
                value={nouvelleCat}
                onChange={(e) => setNouvelleCat(e.target.value)}
                placeholder="Nouvelle catégorie (ex: Boissons)"
                maxLength={60}
                style={{ flex: 1, minWidth: 0, margin: 0 }}
              />
              <button type="submit" className="submit-btn" disabled={!nouvelleCat.trim()}>
                Ajouter
              </button>
            </form>
            {catErreur && <p className="settings-msg err">{catErreur}</p>}

            {categories.length === 0 ? (
              <p className="section-hint">Aucune catégorie pour l&apos;instant.</p>
            ) : (
              <div className="admin-list">
                {categories.map((c, i) => (
                  <div className="admin-row" key={c.id}>
                    <div className="admin-row-main">
                      {renommerId === c.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            renommerCategorie(c.id);
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
                      <button className="admin-icon-btn" disabled={i === 0} onClick={() => deplacerCategorie(i, -1)} aria-label="Monter">
                        ▲
                      </button>
                      <button className="admin-icon-btn" disabled={i === categories.length - 1} onClick={() => deplacerCategorie(i, 1)} aria-label="Descendre">
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
                      <button className="admin-icon-btn danger" onClick={() => supprimerCategorie(c)}>
                        Retirer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
