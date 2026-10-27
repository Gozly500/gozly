"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { IconIntegration } from "@/components/icons/GozlyIcons";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";
import { IconAttention, IconFlecheBas, IconFlecheDroite } from "@/components/icons/Pictogrammes";
import MenuActions from "@/components/MenuActions";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";
import ListeReordonnable from "@/components/ListeReordonnable";

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
  const entrees = [...parBase.values()].map((g) =>
    g.produits.length === 1 && !separerNom(g.produits[0].nom).variante ? { type: "simple", produit: g.produits[0] } : { type: "groupe", ...g }
  );
  // Dans l'ordre choisi par glisser-déposer (« Réorganiser ») ; les produits pas encore classés viennent après, dans l'ordre d'avant.
  const rang = (e) => Math.min(...produitsDe(e).map((p) => p.ordre ?? Infinity));
  return entrees.sort((a, b) => (rang(a) === rang(b) ? 0 : rang(a) < rang(b) ? -1 : 1));
}

// Les produits d'une entrée (un produit simple, ou toutes les variantes d'un groupe) et son identifiant stable.
const produitsDe = (e) => (e.type === "simple" ? [e.produit] : e.produits);
const cleEntree = (e) => (e.type === "simple" ? `p-${e.produit.id}` : `g-${e.base.toLowerCase()}`);

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
  const { t } = useT();
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
  const [reorgId, setReorgId] = useState(null); // catégorie (ou « sans ») dont on réorganise les produits
  const [erreurOrdre, setErreurOrdre] = useState("");
  const [selection, setSelection] = useState(() => new Set()); // ids des produits cochés
  const [actionEnCours, setActionEnCours] = useState(false);

  // Catégories de produits. categoriesPretes = la table existe (inventaire_categories.sql exécuté).
  const [categories, setCategories] = useState([]);
  const [categoriesPretes, setCategoriesPretes] = useState(false);
  const [filtreCategorie, setFiltreCategorie] = useState("toutes"); // "toutes" | "sans" | id
  const [recherche, setRecherche] = useState("");
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
        setSyncMsg({ type: "err", text: `${data.error || t("L'envoi vers Wix a échoué.")}${data.detail ? ` [${data.detail}]` : ""}` });
      } else if (data.cree) {
        setSyncMsg({ type: "ok", text: t("Produit créé sur Wix (masqué : affiche-le dans Wix quand tu es prêt). Il est maintenant lié à Wix.") });
        load();
      }
    } catch {
      setSyncMsg({ type: "err", text: t("L'envoi vers Wix a échoué.") });
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
        setSyncMsg({ type: "err", text: data.error || t("La synchronisation a échoué.") });
      } else {
        setSyncMsg({ type: "ok", text: t("{n} produit(s) synchronisé(s) depuis Wix", { n: data.count }) + (typeof data.categories === "number" ? " · " + t("{n} catégorie(s)", { n: data.categories }) : "") + "." });
        load();
      }
    } catch {
      setSyncMsg({ type: "err", text: t("La synchronisation a échoué.") });
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

  // ---------- Sélection multiple ----------
  function cocher(ids, coche) {
    setSelection((prev) => {
      const suivant = new Set(prev);
      ids.forEach((id) => (coche ? suivant.add(id) : suivant.delete(id)));
      return suivant;
    });
  }

  // Les requêtes .in() passent par l'adresse : on les découpe par paquets de 50.
  async function parPaquets(ids, operation) {
    for (let i = 0; i < ids.length; i += 50) {
      const { error } = await operation(ids.slice(i, i + 50));
      if (error) return error;
    }
    return null;
  }

  async function retirerSelection() {
    const ids = produits.filter((p) => selection.has(p.id)).map((p) => p.id);
    if (ids.length === 0) return;
    const avecWix = produits.some((p) => selection.has(p.id) && p.source === "wix");
    const message = t("Retirer {n} produit(s) ? Cette action est irréversible.", { n: ids.length }) + (avecWix ? " " + t("Les produits venus de Wix reviendront à la prochaine synchronisation Wix.") : "");
    if (!window.confirm(message)) return;
    setActionEnCours(true);
    setSyncMsg(null);
    const erreur = await parPaquets(ids, (lot) => supabase.from("produits_inventaire").delete().in("id", lot));
    setActionEnCours(false);
    setSelection(new Set());
    setSyncMsg(erreur ? { type: "err", text: t("L'opération a échoué.") } : { type: "ok", text: t("{n} produit(s) retiré(s).", { n: ids.length }) });
    load();
  }

  async function deplacerSelection(categorieId) {
    const ids = produits.filter((p) => selection.has(p.id)).map((p) => p.id);
    if (ids.length === 0) return;
    setActionEnCours(true);
    setSyncMsg(null);
    const erreur = await parPaquets(ids, (lot) => supabase.from("produits_inventaire").update({ categorie_id: categorieId || null }).in("id", lot));
    setActionEnCours(false);
    setSelection(new Set());
    setSyncMsg(erreur ? { type: "err", text: t("L'opération a échoué.") } : { type: "ok", text: t("{n} produit(s) déplacé(s).", { n: ids.length }) });
    load();
  }

  // ---------- Actions de la connexion Wix (menu « Wix ») ----------
  async function detacherWix() {
    const n = produits.filter((p) => p.source === "wix").length;
    if (n === 0) return;
    if (!window.confirm(t("Détacher {n} produit(s) de Wix ? Ils restent dans Gozly mais ne sont plus liés à Wix (leur quantité ne se synchronise plus). Si tu synchronises Wix ensuite, les produits de Wix seront recréés en double.", { n }))) return;
    setSyncMsg(null);
    const { error } = await supabase.from("produits_inventaire").update({ source: null, source_id: null }).eq("entreprise_id", entrepriseId).eq("source", "wix");
    setSyncMsg(error ? { type: "err", text: t("L'opération a échoué.") } : { type: "ok", text: t("{n} produit(s) détaché(s) de Wix.", { n }) });
    load();
  }

  async function retirerProduitsWix() {
    const n = produits.filter((p) => p.source === "wix").length;
    if (n === 0) return;
    if (!window.confirm(t("Retirer les {n} produit(s) venus de Wix ? Ils seront supprimés de Gozly (pas de Wix) et reviendront si tu synchronises Wix de nouveau. Les catégories ne sont pas supprimées.", { n }))) return;
    setSyncMsg(null);
    const { error } = await supabase.from("produits_inventaire").delete().eq("entreprise_id", entrepriseId).eq("source", "wix");
    setSyncMsg(error ? { type: "err", text: t("L'opération a échoué.") } : { type: "ok", text: t("{n} produit(s) venu(s) de Wix retiré(s).", { n }) });
    load();
  }

  async function handleDelete(id) {
    await supabase.from("produits_inventaire").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>;
  }

  const nbWix = produits.filter((p) => p.source === "wix").length;

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
          { id: "sans", nom: t("Sans catégorie"), produits: produitsVisibles.filter(sansCategorie) },
        ].filter((g) => g.produits.length > 0 && (filtreCategorie === "toutes" || (filtreCategorie === "sans" ? g.id === "sans" : g.id === filtreCategorie)))
      : [{ id: "tous", nom: null, produits: produitsVisibles }];

  const optionsFiltre = [
    { id: "toutes", nom: t("Toutes les catégories") },
    ...categories.map((c) => ({ id: c.id, nom: c.nom })),
    { id: "sans", nom: t("Sans catégorie") },
  ];
  const optionsCategorieProduit = [{ id: "", nom: t("Sans catégorie") }, ...categories.map((c) => ({ id: c.id, nom: c.nom }))];

  // Après un glisser-déposer : on renumérote toutes les entrées de la catégorie (1, 2, 3...) ; les variantes d'un produit partagent
  // son numéro. Affichage immédiat, puis enregistrement (colonne produits_inventaire.ordre : supabase/produits_ordre.sql).
  async function reordonnerEntrees(nouvelles) {
    setErreurOrdre("");
    const ordreDe = new Map();
    nouvelles.forEach((e, i) => produitsDe(e).forEach((p) => ordreDe.set(p.id, i + 1)));
    const avant = new Map(produits.map((p) => [p.id, p.ordre]));
    setProduits((prev) => prev.map((p) => (ordreDe.has(p.id) ? { ...p, ordre: ordreDe.get(p.id) } : p)));
    const aChanger = [...ordreDe].filter(([id, ordre]) => avant.get(id) !== ordre);
    const resultats = await Promise.all(aChanger.map(([id, ordre]) => supabase.from("produits_inventaire").update({ ordre }).eq("id", id)));
    if (resultats.some((r) => r.error)) {
      setErreurOrdre(t("Impossible d'enregistrer l'ordre. As-tu exécuté produits_ordre.sql dans Supabase?"));
      load();
    }
  }

  function ligneProduit(p, { variante = false } = {}) {
    const enAlerte = p.quantite <= p.seuil_alerte;
    const titre = variante ? separerNom(p.nom).variante || "Standard" : p.nom;
    return (
      <div className={`admin-row${variante ? " inventaire-variante" : ""}`} key={p.id}>
        <input
          type="checkbox"
          className="case-selection"
          checked={selection.has(p.id)}
          onChange={(e) => cocher([p.id], e.target.checked)}
          aria-label={t("Sélectionner ce produit")}
        />
        <div className="admin-row-main">
          <div className="admin-row-title" style={enAlerte ? { color: "#ff9494" } : undefined}>
            {!variante && <span className="inventaire-chevron" />}{titre} {p.source === "wix" && <IconIntegration className="gozly-icon" />} {enAlerte && <IconAttention className="gozly-icon" />}
          </div>
          <div className="admin-row-sub">
            {p.sku && `SKU: ${p.sku} · `}
            {t("Quantité:")}{" "}{p.quantite}{" "}{t("· Seuil d'alerte:")}{" "}{p.seuil_alerte}
            {p.prix != null && ` · ${t("Prix:")} ${Number(p.prix).toLocaleString(loc(), { style: "currency", currency: "CAD" })}`}
            {p.notes && ` · ${p.notes}`}
          </div>
        </div>
        <div className="admin-row-controls">
          {((p.source === "wix" && !wixPushAuto) || (wixConnecte && !p.source && !separerNom(p.nom).variante)) && (
            <button className="admin-icon-btn" onClick={() => pousserVersWix(p.id)} disabled={pushingId === p.id}>
              {pushingId === p.id ? "..." : <><IconIntegration className="gozly-icon" />{" "}{t("Pousser vers Wix")}</>}
            </button>
          )}
          <button className="admin-icon-btn" onClick={() => openEdit(p)}>
            {t("Modifier")}
          </button>
          <button className="admin-icon-btn danger" onClick={() => handleDelete(p.id)}>
            {t("Retirer")}
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
    const idsGroupe = e.produits.map((p) => p.id);
    const nbCoches = idsGroupe.filter((id) => selection.has(id)).length;
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
          <input
            type="checkbox"
            className="case-selection"
            ref={(el) => {
              if (el) el.indeterminate = nbCoches > 0 && nbCoches < idsGroupe.length;
            }}
            checked={nbCoches === idsGroupe.length}
            onClick={(ev) => ev.stopPropagation()}
            onChange={(ev) => cocher(idsGroupe, ev.target.checked)}
            aria-label={t("Sélectionner ce produit")}
          />
          <div className="admin-row-main">
            <div className="admin-row-title" style={enAlerte ? { color: "#ff9494" } : undefined}>
              <span className="inventaire-chevron">{ouvert ? <IconFlecheBas className="gozly-icon-inline" /> : <IconFlecheDroite className="gozly-icon-inline" />}</span> {e.base} {enAlerte && <IconAttention className="gozly-icon" />}
            </div>
            <div className="admin-row-sub">
              {e.produits.length}{" "}{t("variante")}{e.produits.length > 1 ? "s" : ""}{" "}{t("· Quantité totale:")}{" "}{total}
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
              {t("+ Variante")}
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
          <h2>{t("Produits")}</h2>
          <p className="panel-hint" style={{ marginBottom: 0 }}>
            {t("Tes produits, leurs quantités en stock et leur seuil d'alerte.")}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {(wixConnecte || nbWix > 0) && (
            <MenuActions
              libelle="Wix"
              icone={<IconIntegration className="gozly-icon" />}
              actions={[
                ...(wixConnecte
                  ? [{ id: "sync", libelle: syncing ? t("Synchronisation...") : t("Synchroniser"), detail: t("Récupère les produits et les catégories de Wix"), desactive: syncing, onClick: handleSyncWix }]
                  : []),
                {
                  id: "detacher",
                  libelle: t("Détacher de Wix"),
                  detail: nbWix ? t("{n} produit(s) restent dans Gozly, sans lien avec Wix", { n: nbWix }) : t("Aucun produit lié à Wix"),
                  desactive: nbWix === 0,
                  onClick: detacherWix,
                },
                {
                  id: "retirer",
                  libelle: t("Retirer tous les produits Wix"),
                  detail: nbWix ? t("Supprime de Gozly les {n} produit(s) venus de Wix", { n: nbWix }) : t("Aucun produit lié à Wix"),
                  danger: true,
                  desactive: nbWix === 0,
                  onClick: retirerProduitsWix,
                },
              ]}
            />
          )}
          <button className="submit-btn" onClick={openAdd}>
            {t("+ Ajouter un produit")}
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
            placeholder={t("Rechercher un produit (nom, variante, SKU...)")}
            style={{ flex: "1 1 260px", maxWidth: "420px", minWidth: 0, margin: 0, boxSizing: "border-box" }}
          />
          {categoriesPretes && categories.length > 0 && (
            <div style={{ width: "260px", maxWidth: "100%" }}>
              <MenuChoix options={optionsFiltre} value={filtreCategorie} onChange={setFiltreCategorie} />
            </div>
          )}
        </div>
      )}

      {selection.size > 0 && (
        <div className="produits-barre-selection">
          <strong>{t("{n} sélectionné(s)", { n: selection.size })}</strong>
          <button type="button" className="admin-icon-btn" onClick={() => cocher(groupes.flatMap((g) => g.produits.map((p) => p.id)), true)}>
            {t("Tout sélectionner")}
          </button>
          <button type="button" className="admin-icon-btn" onClick={() => setSelection(new Set())}>
            {t("Annuler")}
          </button>
          {categoriesPretes && categories.length > 0 && (
            <MenuActions
              libelle={t("Déplacer vers une catégorie")}
              disabled={actionEnCours}
              actions={[...categories.map((c) => ({ id: c.id, libelle: c.nom, onClick: () => deplacerSelection(c.id) })), { separateur: true }, { id: "sans", libelle: t("Sans catégorie"), onClick: () => deplacerSelection(null) }]}
            />
          )}
          <button type="button" className="admin-icon-btn danger" onClick={retirerSelection} disabled={actionEnCours}>
            {actionEnCours ? "..." : t("Retirer")}
          </button>
        </div>
      )}

      {erreurOrdre && <p className="settings-msg err">{erreurOrdre}</p>}

      {produits.length === 0 ? (
        <div className="admin-list" style={{ maxWidth: "900px" }}>
          <div className="admin-empty">{t("Aucun produit pour l'instant.")}</div>
        </div>
      ) : groupes.length === 0 ? (
        <div className="admin-list" style={{ maxWidth: "900px" }}>
          <div className="admin-empty">{mots.length > 0 ? t("Aucun produit pour cette recherche.") : t("Aucun produit dans cette catégorie.")}</div>
        </div>
      ) : (
        groupes.map((g) => (
          <div key={g.id} style={{ marginBottom: "22px" }}>
            {(() => {
              const entrees = construireEntrees(g.produits);
              const peutReorg = mots.length === 0 && entrees.length > 1; // pas pendant une recherche : la liste est filtrée
              const enReorg = peutReorg && reorgId === g.id;
              return (
                <>
                  {(g.nom || peutReorg) && (
                    <div className="inventaire-categorie-titre" style={{ display: "flex", alignItems: "center", gap: "10px", maxWidth: "900px" }}>
                      {!enReorg && (
                        <input
                          type="checkbox"
                          className="case-selection"
                          ref={(el) => {
                            if (el) {
                              const n = g.produits.filter((p) => selection.has(p.id)).length;
                              el.indeterminate = n > 0 && n < g.produits.length;
                            }
                          }}
                          checked={g.produits.length > 0 && g.produits.every((p) => selection.has(p.id))}
                          onChange={(e) => cocher(g.produits.map((p) => p.id), e.target.checked)}
                          aria-label={t("Sélectionner tous les produits de cette catégorie")}
                        />
                      )}
                      <span style={{ color: "var(--fg)", fontWeight: 700, fontSize: "15px" }}>
                        {g.nom} {g.nom && <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: "13px" }}>({g.produits.length})</span>}
                      </span>
                      {peutReorg && (
                        <button type="button" className="admin-icon-btn" style={{ marginLeft: "auto" }} onClick={() => setReorgId(enReorg ? null : g.id)}>
                          {enReorg ? t("Terminé") : t("Réorganiser")}
                        </button>
                      )}
                    </div>
                  )}
                  {enReorg ? (
                    <>
                      <p className="section-hint" style={{ margin: "0 0 10px 4px", maxWidth: "900px" }}>
                        {t("Glisse les produits pour choisir leur ordre : celui du haut s'affiche en premier dans le kiosque et dans la prise de commande.")}
                      </p>
                      <ListeReordonnable
                        className="admin-list"
                        style={{ maxWidth: "900px" }}
                        items={entrees}
                        getId={cleEntree}
                        onReorder={reordonnerEntrees}
                        renderItem={(e, i, gp) => (
                          <div className="admin-row" key={cleEntree(e)} ref={gp.ref} style={gp.style}>
                            {gp.poignee}
                            <div className="admin-row-main">
                              <div className="admin-row-title">{e.type === "simple" ? e.produit.nom : e.base}</div>
                              {e.type === "groupe" && (
                                <div className="admin-row-sub">
                                  {e.produits.length} {t("variante")}
                                  {e.produits.length > 1 ? "s" : ""}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      />
                    </>
                  ) : (
                    <div className="admin-list" style={{ maxWidth: "900px" }}>
                      {entrees.map(rendreEntree)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ))
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingId ? t("Modifier le produit") : t("Ajouter un produit")}</h3>
              <button className="admin-icon-btn" onClick={() => setModalOpen(false)}>
                {t("Fermer")}
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field-row">
                <div className="field">
                  <label>{t("Nom du produit")}</label>
                  <input
                    type="text"
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    placeholder={t("Ex: T-shirt noir M")}
                    required
                  />
                </div>
                <div className="field">
                  <label>{t("SKU (optionnel)")}</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder={t("Ex: TSN-M")}
                  />
                </div>
              </div>

              <div className="field">
                <label>{t("Variante (optionnel)")}</label>
                <input
                  type="text"
                  value={form.variante}
                  onChange={(e) => setForm((f) => ({ ...f, variante: e.target.value }))}
                  placeholder={t("Ex: Complète, Demi, Quart")}
                  maxLength={60}
                />
              </div>

              {categoriesPretes && (
                <div className="field">
                  <label>{t("Catégorie")}</label>
                  <MenuChoix options={optionsCategorieProduit} value={form.categorieId} onChange={(id) => setForm((f) => ({ ...f, categorieId: id }))} />
                  {categories.length === 0 && (
                    <p className="section-hint" style={{ marginTop: "6px" }}>
                      {t("Aucune catégorie pour l'instant : crée-en dans le sous-menu « Catégories » d'Inventaire (menu de gauche).")}
                    </p>
                  )}
                </div>
              )}

              <div className="field-row">
                <div className="field">
                  <label>{t("Quantité")}</label>
                  <input
                    type="number"
                    value={form.quantite}
                    onChange={(e) => setForm((f) => ({ ...f, quantite: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="field">
                  <label>{t("Seuil d'alerte")}</label>
                  <input
                    type="number"
                    value={form.seuilAlerte}
                    onChange={(e) => setForm((f) => ({ ...f, seuilAlerte: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="field">
                <label>{t("Prix de vente (optionnel)")}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.prix}
                  onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                  placeholder={t("Ex: 12.50 (utilisé pour les commandes manuelles)")}
                />
              </div>

              <div className="field">
                <label>{t("Notes (optionnel)")}</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t("Ex: fournisseur, emplacement en entrepôt...")}
                />
              </div>

              <div className="admin-edit-actions">
                <button type="submit" className="submit-btn" disabled={saving}>
                  {saving ? t("Enregistrement...") : editingId ? t("Enregistrer") : t("Ajouter")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
