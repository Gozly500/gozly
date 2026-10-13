"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SimpleSelect from "@/components/SimpleSelect";

const DUREES = [
  { id: "24", label: "24 heures" },
  { id: "72", label: "3 jours" },
  { id: "168", label: "1 semaine" },
  { id: "336", label: "2 semaines" },
  { id: "720", label: "1 mois" },
];

// Annonces du propriétaire : écrire une annonce (durée au choix) et voir / retirer celles en cours.
// Elle s'affiche en évidence en haut de l'app employé jusqu'à son expiration, et les employés reçoivent une notification.
export default function AnnoncesModal({ entrepriseId, onClose }) {
  const [contenu, setContenu] = useState("");
  const [duree, setDuree] = useState("168");
  const [encours, setEncours] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    charger();
  }, [entrepriseId]);

  async function charger() {
    const maintenant = new Date().toISOString();
    const { data } = await supabase
      .from("annonces")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gt("fin", maintenant)
      .order("debut", { ascending: false });
    setEncours(data || []);
  }

  async function publier(e) {
    e.preventDefault();
    if (!contenu.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/annonces", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ entrepriseId, contenu: contenu.trim(), dureeHeures: Number(duree) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "La publication a échoué." });
      } else {
        setContenu("");
        setMsg({ type: "ok", text: "Annonce publiée. Les employés ont reçu une notification." });
        charger();
      }
    } catch {
      setMsg({ type: "err", text: "La publication a échoué." });
    }
    setBusy(false);
  }

  async function retirer(id) {
    await supabase.from("annonces").delete().eq("id", id);
    charger();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Annonce</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            Fermer
          </button>
        </div>

        <p className="panel-hint">Un message mis en évidence en haut de l'app de tous tes employés, pendant la durée que tu choisis.</p>

        <form onSubmit={publier}>
          <div className="field">
            <label>Annonce</label>
            <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={4} maxLength={600} placeholder="Ex: La caisse sera fermée samedi matin pour l'inventaire." />
          </div>
          <div className="field">
            <label>Affichée pendant</label>
            <SimpleSelect options={DUREES} value={duree} onChange={setDuree} />
          </div>
          {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
          <button type="submit" className="submit-btn" disabled={busy || !contenu.trim()}>
            {busy ? "Publication..." : "Publier l'annonce"}
          </button>
        </form>

        {encours.length > 0 && (
          <div style={{ marginTop: "22px" }}>
            <h4 style={{ fontSize: "14.5px", fontWeight: 600 }}>En cours</h4>
            <div className="admin-list">
              {encours.map((a) => (
                <div className="admin-row" key={a.id}>
                  <div className="admin-row-main">
                    <div className="admin-row-title" style={{ whiteSpace: "normal" }}>{a.contenu}</div>
                    <div className="admin-row-sub">Jusqu'au {new Date(a.fin).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" })}</div>
                  </div>
                  <div className="admin-row-controls">
                    <button className="admin-icon-btn danger" onClick={() => retirer(a.id)}>
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
