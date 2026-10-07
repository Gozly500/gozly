"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { IconIntegration } from "@/components/icons/GozlyIcons";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";
import { IconAttention, IconFlecheBas, IconFlecheDroite, IconLoupe } from "@/components/icons/Pictogrammes";

const FORM_VIDE = { nom: "", variante: "", sku: "", quantite: "", seuilAlerte: "", prix: "", notes: "", categorieId: "" };

// Sans accents ni majuscules : « cafe » trouve « Café ».
function normaliser(x) {
  return String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Une variante s'écrit « Produit — Variante » dans le nom (c'est aussi comme ça que Wix la synchronise).
// Les produits qui partagent le même nom de base sont regroupés : Pizza — Complète, Demi, Quart.
const SEP = " — ";
function separerNom(nom) {
  const [base, ...reste] = String(nom).split(SEP);
  return reste.length > 0 ? { base: base.trim(), variante: reste.join(SEP).trim() } : { base: String(nom).trim(), variante: "" };
}
function composerNom(base, variante) {
  return variante.trim() ? `${base.trim()}${SEP}${variante.trim()}` : base.trim();
}

// Regroupe une liste de produits par nom de base : { type: "simple", produit } ou { type: "groupe", base, produits }.
function construireEntrees(liste) {
  const parBase = new Map();
  for (const p of liste) {
    const { base } = separerNom(p.nom);
    const cle = base.toLowerCase();
    if (!parBase.has(cle)) parBase.set(cle, { base, produits: [] });
    parBase.get(cle).produits.push(p);
  }
  return [...parBase.values()].map((g) =>
    g.produits.length === 1 && !separerNom(g.produits[0].nom).variante ? { type: "simple", produit: g.produits[0] } : { type: "groupe", ...g }
  );
}

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
        <span className="fs-arrow"><IconFlecheBas className="gozly-icon-inline" /></span>
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
  const [recherche, setRecherche] = useState("");
  const [diagOuvert, setDiagOuvert] = useState(false);
  const [diagTerme, setDiagTerme] = useState("");
  const [diagResultat, setDiagResultat] = useState(null);
  const [diagBusy, setDiagBusy] = useState(false);
  const [groupesOuverts, setGroupesOuverts] = useState(() => new Set()); // produits à variantes dépliés

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
        setSyncMsg({ type: "err", text: `${data.error || "L'envoi vers Wix a échoué."}${data.detail ? ` [${data.detail}]` : ""}` });
      } else if (data.cree) {
        setSyncMsg({ type: "ok", text: "Produit créé sur Wix (masqué : affiche-le dans Wix quand tu es prêt). Il est maintenant lié à Wix." });
        load();
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
        setSyncMsg({ type: "ok", text: `${data.count} produit(s) synchronisé(s) depuis Wix${typeof data.categories === "number" ? ` · ${data.categories} catégorie(s)` : ""}.` });
        load();
      }
    } catch {
      setSyncMsg({ type: "err", text: "La synchronisation a échoué." });
    }
    setSyncing(false);
  }

  // Diagnostic : ce que Wix répond réellement pour les produits (pour comprendre ceux qui manquent).
  async function lancerDiagnostic() {
    setDiagBusy(true);
    setDiagResultat(null);
    try {
      const res = await fetch("/api/inventaire/diagnostic-wix", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId, terme: diagTerme }),
      });
      const data = await res.json();
      setDiagResultat(res.ok ? data.diagnostic : { erreur: data.error, detail: data.detail });
    } catch {
      setDiagResultat({ erreur: "Le diagnostic a échoué." });
    }
    setDiagBusy(false);
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

  // « + Variante » sur un produit : même nom et même catégorie, il reste à nommer la variante.
  function ouvrirAjoutVariante(base, categorieId) {
    setEditingId(null);
    setForm({ ...FORM_VIDE, nom: base, categorieId: categorieId || "" });
    setModalOpen(true);
  }

  function openEdit(produit) {
    setEditingId(produit.id);
    const { base, variante } = separerNom(produit.nom);
    setForm({
      nom: base,
      variante,
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
      nom: composerNom(form.nom, form.variante),
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

    // La catégorie est celle du produit : toutes ses variantes la partagent.
    if (categoriesPretes) {
      const base = form.nom.trim().toLowerCase();
      const freres = produits.filter((p) => p.id !== editingId && separerNom(p.nom).base.toLowerCase() === base);
      if (freres.length > 0) {
        await supabase
          .from("produits_inventaire")
          .update({ categorie_id: form.categorieId || null })
          .in("id", freres.map((p) => p.id));
      }
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("produits_inventaire").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  // ---------- Recherche + affichage groupé par catégorie ----------
  const mots = normaliser(recherche).split(/s+/).filter(Boolean);
  const produitsVisibles =
    mots.length === 0
      ? produits
      : produits.filter((p) => {
          const categorie = categories.find((c) => c.id === p.categorie_id)?.nom;
          const texte = normaliser([p.nom, p.sku, p.notes, categorie].filter(Boolean).join(" "));
          return mots.every((m) => texte.includes(m));
        });

  const appartient = (p, c) => p.categorie_id === c.id;
  const sansCategorie = (p) => !p.categorie_id || !categories.some((c) => c.id === p.categorie_id);

  const groupes =
    categoriesPretes && categories.length > 0
      ? [
          ...categories.map((c) => ({ id: c.id, nom: c.nom, produits: produitsVisibles.filter((p) => appartient(p, c)) })),
          { id: "sans", nom: "Sans catégorie", produits: produitsVisibles.filter(sansCategorie) },
        ].filter((g) => g.produits.length > 0 && (filtreCategorie === "toutes" || (filtreCategorie === "sans" ? g.id === "sans" : g.id === filtreCategorie)))
      : [{ id: "tous", nom: null, produits: produitsVisibles }];

  const optionsFiltre = [
    { id: "toutes", nom: "Toutes les catégories" },
    ...categories.map((c) => ({ id: c.id, nom: c.nom })),
    { id: "sans", nom: "Sans catégorie" },
  ];
  const optionsCategorieProduit = [{ id: "", nom: "Sans catégorie" }, ...categories.map((c) => ({ id: c.id, nom: c.nom }))];

  function ligneProduit(p, { variante = false } = {}) {
    const enAlerte = p.quantite <= p.seuil_alerte;
    const titre = variante ? separerNom(p.nom).variante || "Standard" : p.nom;
    return (
      <div className={`admin-row${variante ? " inventaire-variante" : ""}`} key={p.id}>
        <div className="admin-row-main">
          <div className="admin-row-title" style={enAlerte ? { color: "#ff9494" } : undefined}>
            {!variante && <span className="inventaire-chevron" />}{titre} {p.source === "wix" && <IconIntegration className="gozly-icon" />} {enAlerte && <IconAttention className="gozly-icon" />}
          </div>
          <div className="admin-row-sub">
            {p.sku && `SKU: ${p.sku} · `}
            Quantité: {p.quantite} · Seuil d'alerte: {p.seuil_alerte}
            {p.prix != null && ` · Prix: ${Number(p.prix).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`}
            {p.notes && ` · ${p.notes}`}
          </div>
        </div>
        <div className="admin-row-controls">
          {((p.source === "wix" && !wixPushAuto) || (wixConnecte && !p.source && !separerNom(p.nom).variante)) && (
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

  function rendreEntree(e) {
    if (e.type === "simple") return ligneProduit(e.produit);
    const total = e.produits.reduce((somme, p) => somme + (Number(p.quantite) || 0), 0);
    const enAlerte = e.produits.some((p) => p.quantite <= p.seuil_alerte);
    const cle = e.base.toLowerCase();
    // Replié par défaut ; une recherche déplie tout pour montrer les variantes trouvées.
    const ouvert = groupesOuverts.has(cle) || mots.length > 0;
    return (
      <Fragment key={`groupe-${e.base}`}>
        <div
          className="admin-row inventaire-groupe-tete"
          style={{ cursor: "pointer" }}
          onClick={() =>
            setGroupesOuverts((prev) => {
              const suivant = new Set(prev);
              if (suivant.has(cle)) suivant.delete(cle);
              else suivant.add(cle);
              return suivant;
            })
          }
        >
          <div className="admin-row-main">
            <div className="admin-row-title" style={enAlerte ? { color: "#ff9494" } : undefined}>
              <span className="inventaire-chevron">{ouvert ? <IconFlecheBas className="gozly-icon-inline" /> : <IconFlecheDroite className="gozly-icon-inline" />}</span> {e.base} {enAlerte && <IconAttention className="gozly-icon" />}
            </div>
            <div className="admin-row-sub">
              {e.produits.length} variante{e.produits.length > 1 ? "s" : ""} · Quantité totale: {total}
            </div>
          </div>
          <div className="admin-row-controls">
            <button
              className="admin-icon-btn"
              onClick={(ev) => {
                ev.stopPropagation();
                ouvrirAjoutVariante(e.base, e.produits[0].categorie_id);
              }}
            >
              + Variante
            </button>
          </div>
        </div>
        {ouvert && e.produits.map((p) => ligneProduit(p, { variante: true }))}
      </Fragment>
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
          {wixConnecte && (
            <button className="admin-icon-btn" onClick={() => setDiagOuvert(true)}>
              <IconLoupe className="gozly-icon" /> Diagnostic Wix
            </button>
          )}
          <button className="submit-btn" onClick={openAdd}>
            + Ajouter un produit
          </button>
        </div>
      </div>

      {syncMsg && <p className={`settings-msg ${syncMsg.type}`}>{syncMsg.text}</p>}

      {produits.length > 0 && (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "16px" }}>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un produit (nom, variante, SKU...)"
            style={{ flex: "1 1 260px", maxWidth: "420px", minWidth: 0, margin: 0, boxSizing: "border-box" }}
          />
          {categoriesPretes && categories.length > 0 && (
            <div style={{ width: "260px", maxWidth: "100%" }}>
              <MenuChoix options={optionsFiltre} value={filtreCategorie} onChange={setFiltreCategorie} />
            </div>
          )}
        </div>
      )}

      {produits.length === 0 ? (
        <div className="admin-list" style={{ maxWidth: "900px" }}>
          <div className="admin-empty">Aucun produit pour l'instant.</div>
        </div>
      ) : groupes.length === 0 ? (
        <div className="admin-list" style={{ maxWidth: "900px" }}>
          <div className="admin-empty">{mots.length > 0 ? "Aucun produit pour cette recherche." : "Aucun produit dans cette catégorie."}</div>
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
              {construireEntrees(g.produits).map(rendreEntree)}
            </div>
          </div>
        ))
      )}

      {diagOuvert && (
        <div className="modal-overlay" onClick={() => setDiagOuvert(false)}>
          <div className="modal-card" style={{ maxWidth: "620px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Diagnostic Wix</h3>
              <button className="admin-icon-btn" onClick={() => setDiagOuvert(false)}>
                Fermer
              </button>
            </div>
            <p className="section-hint">
              Montre ce que Wix répond pour tes produits. Tape le début du nom d&apos;un produit qui manque (ex: Lasagne) pour voir si Wix le renvoie.
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input type="text" value={diagTerme} onChange={(e) => setDiagTerme(e.target.value)} placeholder="Début du nom (optionnel)" style={{ flex: 1, minWidth: 0, margin: 0 }} />
              <button className="submit-btn" onClick={lancerDiagnostic} disabled={diagBusy}>
                {diagBusy ? "..." : "Lancer"}
              </button>
            </div>
            {diagResultat && <pre className="diag-resultat">{JSON.stringify(diagResultat, null, 2)}</pre>}
          </div>
        </div>
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

              <div className="field">
                <label>Variante (optionnel)</label>
                <input
                  type="text"
                  value={form.variante}
                  onChange={(e) => setForm((f) => ({ ...f, variante: e.target.value }))}
                  placeholder="Ex: Complète, Demi, Quart"
                  maxLength={60}
                />
              </div>

              {categoriesPretes && (
                <div className="field">
                  <label>Catégorie</label>
                  <MenuChoix options={optionsCategorieProduit} value={form.categorieId} onChange={(id) => setForm((f) => ({ ...f, categorieId: id }))} />
                  {categories.length === 0 && (
                    <p className="section-hint" style={{ marginTop: "6px" }}>
                      Aucune catégorie pour l'instant : crée-en dans le sous-menu « Catégories » d'Inventaire (menu de gauche).
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

    </div>
  );
}
