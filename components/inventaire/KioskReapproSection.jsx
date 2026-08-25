"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function KioskReapproSection({ entrepriseId }) {
  const [liste, setListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    load();
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
  }, [entrepriseId]);

  async function load() {
    const { data } = await supabase
      .from("demandes_reappro")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true });
    setListe(data || []);
    setLoading(false);
  }

  async function handleFait(id) {
    setBusyId(id);
    await supabase.from("demandes_reappro").delete().eq("id", id);
    setListe((l) => l.filter((item) => item.id !== id));
    setBusyId(null);
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>À aller chercher</h2>
      {liste.length === 0 ? (
        <p className="panel-hint">Rien à préparer pour l'instant.</p>
      ) : (
        <div className="kiosk-reappro-list">
          {liste.map((item) => (
            <button
              key={item.id}
              type="button"
              className="kiosk-reappro-item"
              onClick={() => handleFait(item.id)}
              disabled={busyId === item.id}
            >
              <span className="kiosk-reappro-check">✓</span>
              <span className="kiosk-reappro-nom">{item.nom}</span>
              <span className="kiosk-reappro-qte">× {item.quantite}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
