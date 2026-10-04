"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EmplacementSelect from "@/components/EmplacementSelect";
import { getEmplacementSelectionne, setEmplacementSelectionne } from "@/lib/entreprise";
import { useGestion } from "@/components/gestion/GestionShell";
import { dateAujourdhui, decalerJour, NOM_CATEGORIE_COMMANDES } from "@/lib/commandes";

// Tâches du jour pour le téléphone : on change de jour avec ‹ ›, on coche les tâches,
// on en ajoute dans une catégorie ou on les retire. La catégorie "Réservations" est
// gérée par le module Commandes (on peut cocher, pas retirer).
export default function TachesGestion() {
  const { entrepriseId } = useGestion();
  const [date, setDate] = useState(dateAujourdhui);
  const [categories, setCategories] = useState([]);
  const [taches, setTaches] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementId] = useState(null);
  const [pret, setPret] = useState(false); // catégories + succursales chargées
  const [loading, setLoading] = useState(true);
  const [ajoutPour, setAjoutPour] = useState(null); // categorie_id dont le champ d'ajout est ouvert
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState("");
  const emplacementRef = useRef(null);
  emplacementRef.current = emplacementId;
  const dateRef = useRef(date);
  dateRef.current = date;

  useEffect(() => {
    (async () => {
      const [{ data: cats }, { data: emps }] = await Promise.all([
        supabase.from("categories").select("*").eq("entreprise_id", entrepriseId).order("ordre", { ascending: true }).order("created_at", { ascending: true }),
        supabase.from("emplacements").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
      ]);
      setCategories(cats || []);
      const liste = emps || [];
      setEmplacements(liste);
      if (liste.length > 0) {
        const sauve = getEmplacementSelectionne(entrepriseId);
        setEmplacementId(sauve && liste.some((e) => e.id === sauve) ? sauve : liste[0].id);
      }
      setPret(true);
    })();
  }, [entrepriseId]);

  const chargerTaches = useCallback(async () => {
    let q = supabase.from("taches").select("*").eq("entreprise_id", entrepriseId).eq("date", dateRef.current);
    if (emplacementRef.current) q = q.eq("emplacement_id", emplacementRef.current);
    const { data } = await q.order("created_at", { ascending: true });
    setTaches(data || []);
    setLoading(false);
  }, [entrepriseId]);

  useEffect(() => {
    if (!pret) return;
    setLoading(true);
    chargerTaches();
  }, [pret, date, emplacementId, chargerTaches]);

  // Les employés cochent leurs tâches : on relit toutes les 20 s tant que l'écran est visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") chargerTaches();
    }, 20000);
    return () => clearInterval(id);
  }, [chargerTaches]);

  function choisirEmplacement(id) {
    setEmplacementId(id);
    setEmplacementSelectionne(entrepriseId, id);
  }

  async function basculer(t) {
    setTaches((prev) => prev.map((x) => (x.id === t.id ? { ...x, terminee: !t.terminee } : x)));
    await supabase.from("taches").update({ terminee: !t.terminee }).eq("id", t.id);
  }

  async function retirer(t) {
    setTaches((prev) => prev.filter((x) => x.id !== t.id));
    await supabase.from("taches").delete().eq("id", t.id);
  }

  async function ajouter(e, categorieId) {
    e.preventDefault();
    const nom = texte.trim();
    if (!nom) return;
    setErreur("");
    const { error } = await supabase.from("taches").insert({
      entreprise_id: entrepriseId,
      categorie_id: categorieId,
      date,
      texte: nom,
      emplacement_id: emplacementId,
    });
    if (error) {
      setErreur("Impossible d'ajouter la tâche.");
      return;
    }
    setTexte("");
    setAjoutPour(null);
    chargerTaches();
  }

  const aujourdhui = dateAujourdhui();
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
  const sansCategorie = taches.filter((t) => !t.categorie_id || !categories.some((c) => c.id === t.categorie_id));

  function carte(cat, liste, { geree = false } = {}) {
    return (
      <div className="planning-day gestion-tache-categorie" key={cat.id}>
        <div className="gestion-tache-tete">
          <span className="planning-day-title">{cat.nom}</span>
          {geree && <span className="forfait-badge" style={{ padding: "3px 10px", fontSize: "11px" }}>Géré par un module</span>}
        </div>
        {liste.map((t) => (
          <div className="gestion-tache-ligne" key={t.id}>
            <label className="planning-tache" style={{ flex: 1, margin: 0 }}>
              <input type="checkbox" checked={!!t.terminee} onChange={() => basculer(t)} />
              <span className={`planning-tache-texte${t.terminee ? " done" : ""}`}>{t.texte}</span>
            </label>
            {t.source !== "commande" && (
              <button type="button" className="admin-icon-btn danger gestion-tache-retirer" onClick={() => retirer(t)} aria-label="Retirer la tâche">
                ✕
              </button>
            )}
          </div>
        ))}
        {!geree &&
          (ajoutPour === cat.id ? (
            <form className="gestion-tache-ajout" onSubmit={(e) => ajouter(e, cat.id)}>
              <input type="text" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Nouvelle tâche" maxLength={200} autoFocus />
              <button type="submit" className="btn-small" disabled={!texte.trim()}>
                Ajouter
              </button>
              <button type="button" className="admin-icon-btn" onClick={() => { setAjoutPour(null); setTexte(""); }}>
                ✕
              </button>
            </form>
          ) : (
            <button type="button" className="gestion-tache-plus" onClick={() => { setAjoutPour(cat.id); setTexte(""); }}>
              + Ajouter
            </button>
          ))}
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: "10px" }}>Tâches</h2>

      <div className="moi-week-nav">
        <button className="admin-icon-btn" onClick={() => setDate((d) => decalerJour(d, -1))}>
          ‹
        </button>
        <span className="moi-week-label" style={{ textTransform: "capitalize" }}>
          {dateLabel}
        </span>
        <button className="admin-icon-btn" onClick={() => setDate((d) => decalerJour(d, 1))}>
          ›
        </button>
      </div>
      {date !== aujourdhui && (
        <div style={{ textAlign: "center", marginTop: "-8px", marginBottom: "12px" }}>
          <button className="admin-icon-btn" onClick={() => setDate(aujourdhui)}>
            Aujourd&apos;hui
          </button>
        </div>
      )}

      <EmplacementSelect emplacements={emplacements} value={emplacementId} onChange={choisirEmplacement} />

      {erreur && <p className="settings-msg err">{erreur}</p>}

      {!pret || loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : categories.length === 0 && taches.length === 0 ? (
        <p className="chat-empty">Aucune catégorie de tâches. Crée-en une sur l&apos;ordinateur (Tâches, Catégories).</p>
      ) : (
        <div className="gestion-cartes" style={{ marginTop: "12px" }}>
          {categories.map((cat) => {
            const liste = taches.filter((t) => t.categorie_id === cat.id);
            const geree = cat.nom === NOM_CATEGORIE_COMMANDES;
            if (geree && liste.length === 0) return null; // pas de tâches de commandes ce jour-là
            return carte(cat, liste, { geree });
          })}
          {sansCategorie.length > 0 && carte({ id: "sans-categorie", nom: "Autres" }, sansCategorie, { geree: true })}
        </div>
      )}
    </div>
  );
}
