"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function DemandeReapproSection({ entrepriseId }) {
  const [produits, setProduits] = useState([]);
  const [selections, setSelections] = useState({}); // produitId -> quantité (string)
  const [libreNom, setLibreNom] = useState("");
  const [libreQte, setLibreQte] = useState("1");
  const [liste, setListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    load();
    const interval = setInterval(loadListe, 8000);
    return () => clearInterval(interval);
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("produits_inventaire")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("nom", { ascending: true });
    setProduits(data || []);
    await loadListe();
    setLoading(false);
  }

  async function loadListe() {
    const { data } = await supabase
      .from("demandes_reappro")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true });
    setListe(data || []);
  }

  function toggleProduit(id) {
    setSelections((s) => {
      const next = { ...s };
      if (id in next) delete next[id];
      else next[id] = "1";
      return next;
    });
  }

  function changeQte(id, val) {
    setSelections((s) => ({ ...s, [id]: val }));
  }

  async function handleEnvoyer() {
    const items = Object.entries(selections)
      .map(([id, qte]) => ({ produitId: id, quantite: Number(qte) || 0 }))
      .filter((it) => it.quantite > 0);
    if (items.length === 0) return;

    setBusy(true);
    setMsg(null);

    const rows = items.map((it) => {
      const produit = produits.find((p) => p.id === it.produitId);
      return {
        entreprise_id: entrepriseId,
        produit_id: it.produitId,
        nom: produit?.nom || "Produit",
        quantite: it.quantite,
      };
    });

    const { error } = await supabase.from("demandes_reappro").insert(rows);

    setBusy(false);
    if (error) {
      setMsg({ type: "err", text: "L'envoi a échoué." });
    } else {
      setSelections({});
      setMsg({ type: "ok", text: "Envoyé au mode kiosk." });
      loadListe();
    }
  }

  async function handleAjouterLibre(e) {
    e.preventDefault();
    if (!libreNom.trim()) return;

    setBusy(true);
    setMsg(null);

    const { error } = await supabase.from("demandes_reappro").insert({
      entreprise_id: entrepriseId,
      produit_id: null,
      nom: libreNom.trim(),
      quantite: Number(libreQte) || 1,
    });

    setBusy(false);
    if (error) {
      setMsg({ type: "err", text: "L'envoi a échoué." });
    } else {
      setLibreNom("");
      setLibreQte("1");
      setMsg({ type: "ok", text: "Envoyé au mode kiosk." });
      loadListe();
    }
  }

  async function handleRetirer(id) {
    await supabase.from("demandes_reappro").delete().eq("id", id);
    loadListe();
  }

  const nbSelections = Object.keys(selections).length;

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Liste à préparer</h2>
      <p className="panel-hint">
        Coche les produits à aller chercher (avec la quantité), ou ajoute un item qui n'est pas dans l'Inventaire.
        Ça s'affiche en direct sur l'écran en mode kiosk.
      </p>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {produits.length > 0 && (
        <div className="admin-list" style={{ maxWidth: "560px", marginBottom: "18px" }}>
          {produits.map((p) => {
            const checked = p.id in selections;
            return (
              <div className="admin-row" key={p.id}>
                <label
                  className="admin-row-main"
                  style={{ flexDirection: "row", alignItems: "center", gap: "10px", cursor: "pointer" }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleProduit(p.id)} />
                  <span className="admin-row-title">{p.nom}</span>
                </label>
                {checked && (
                  <div className="admin-row-controls">
                    <input
                      type="number"
                      min="1"
                      value={selections[p.id]}
                      onChange={(e) => changeQte(p.id, e.target.value)}
                      style={{ width: "70px" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button className="submit-btn" onClick={handleEnvoyer} disabled={busy || nbSelections === 0}>
        Envoyer au mode kiosk{nbSelections > 0 && ` (${nbSelections})`}
      </button>

      <div className="settings-section" style={{ marginTop: "26px", maxWidth: "560px" }}>
        <h3>Item hors catalogue</h3>
        <form onSubmit={handleAjouterLibre} className="field-row" style={{ alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Nom</label>
            <input
              type="text"
              value={libreNom}
              onChange={(e) => setLibreNom(e.target.value)}
              placeholder="Ex: Boîtes en carton"
            />
          </div>
          <div className="field" style={{ maxWidth: "100px" }}>
            <label>Qté</label>
            <input type="number" min="1" value={libreQte} onChange={(e) => setLibreQte(e.target.value)} />
          </div>
          <button type="submit" className="admin-icon-btn" disabled={busy || !libreNom.trim()}>
            + Ajouter
          </button>
        </form>
      </div>

      {liste.length > 0 && (
        <div style={{ marginTop: "26px" }}>
          <h3>Sur la liste en ce moment ({liste.length})</h3>
          <div className="admin-list" style={{ maxWidth: "560px" }}>
            {liste.map((item) => (
              <div className="admin-row" key={item.id}>
                <div className="admin-row-main">
                  <div className="admin-row-title">{item.nom}</div>
                  <div className="admin-row-sub">Quantité: {item.quantite}</div>
                </div>
                <div className="admin-row-controls">
                  <button className="admin-icon-btn danger" onClick={() => handleRetirer(item.id)}>
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
