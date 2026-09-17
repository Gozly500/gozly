"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { geocoderAdresse } from "@/lib/geocode";

export default function EmplacementsSection({ entrepriseId }) {
  const [emplacements, setEmplacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [geocodage, setGeocodage] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editNom, setEditNom] = useState("");
  const [editAdresse, setEditAdresse] = useState("");

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("emplacements")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true });
    setEmplacements(data || []);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!nom.trim()) return;

    const champs = { entreprise_id: entrepriseId, nom: nom.trim(), adresse: adresse.trim() || null };

    if (adresse.trim()) {
      setGeocodage(true);
      const position = await geocoderAdresse(adresse);
      setGeocodage(false);
      if (position) {
        champs.latitude = position.latitude;
        champs.longitude = position.longitude;
      }
    }

    await supabase.from("emplacements").insert(champs);
    setNom("");
    setAdresse("");
    load();
  }

  function startEdit(emp) {
    setEditingId(emp.id);
    setEditNom(emp.nom);
    setEditAdresse(emp.adresse || "");
  }

  async function handleSaveEdit(id) {
    if (!editNom.trim()) return;

    const champs = { nom: editNom.trim(), adresse: editAdresse.trim() || null };

    if (editAdresse.trim()) {
      setGeocodage(true);
      const position = await geocoderAdresse(editAdresse);
      setGeocodage(false);
      champs.latitude = position?.latitude ?? null;
      champs.longitude = position?.longitude ?? null;
    } else {
      champs.latitude = null;
      champs.longitude = null;
    }

    await supabase.from("emplacements").update(champs).eq("id", id);
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("emplacements").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Emplacements</h2>
      <p className="panel-hint">
        Tes succursales. Dès qu'il y en a plus d'une, l'Horaire et le Pointage se gèrent séparément pour chacune.
        Ajoute une adresse pour activer le pointage mobile (GPS) pour les employés qui y sont assignés (à
        activer dans Personnalisation &gt; Horaire &amp; Pointage).
      </p>

      <div className="admin-list" style={{ marginBottom: "20px", maxWidth: "500px" }}>
        {emplacements.map((emp) => (
          <div className="admin-row" key={emp.id}>
            {editingId === emp.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                <input type="text" value={editNom} onChange={(e) => setEditNom(e.target.value)} placeholder="Nom" />
                <input
                  type="text"
                  value={editAdresse}
                  onChange={(e) => setEditAdresse(e.target.value)}
                  placeholder="Adresse (optionnel)"
                />
              </div>
            ) : (
              <div className="admin-row-main">
                <div className="admin-row-title">{emp.nom}</div>
                {emp.adresse && (
                  <div className="admin-row-sub">
                    {emp.adresse}
                    {emp.latitude == null && " — ⚠ position introuvable, pointage mobile indisponible"}
                  </div>
                )}
              </div>
            )}

            <div className="admin-row-controls">
              {editingId === emp.id ? (
                <>
                  <button className="admin-icon-btn" onClick={() => handleSaveEdit(emp.id)} disabled={geocodage}>
                    {geocodage ? "Localisation..." : "Enregistrer"}
                  </button>
                  <button className="admin-icon-btn" onClick={() => setEditingId(null)}>
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <button className="admin-icon-btn" onClick={() => startEdit(emp)}>
                    Modifier
                  </button>
                  <button className="admin-icon-btn danger" onClick={() => handleDelete(emp.id)}>
                    Retirer
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {emplacements.length === 0 && <div className="admin-empty">Un seul emplacement implicite pour l'instant.</div>}
      </div>

      <form className="admin-add-form" onSubmit={handleAdd}>
        <input type="text" placeholder="Nom de la succursale" value={nom} onChange={(e) => setNom(e.target.value)} required />
        <input
          type="text"
          placeholder="Adresse (optionnel)"
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
        />
        <button type="submit" className="btn-small" disabled={geocodage}>
          {geocodage ? "Localisation..." : "Ajouter"}
        </button>
      </form>
    </div>
  );
}
