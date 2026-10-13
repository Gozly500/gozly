"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SimpleSelect from "@/components/SimpleSelect";

const DUREES = [
  { id: "3", label: "3 heures" },
  { id: "12", label: "12 heures" },
  { id: "24", label: "24 heures" },
  { id: "72", label: "3 jours" },
  { id: "168", label: "1 semaine" },
];

// Rappels du propriétaire : en créer un (durée jusqu'à 1 semaine, pour tout le monde ou des employés précis) et voir /
// retirer tous ceux en cours, y compris ceux créés par les employés. Ils s'affichent en évidence en haut de l'app des
// destinataires, qui reçoivent aussi une notification.
export default function RappelsModal({ entrepriseId, onClose }) {
  const [contenu, setContenu] = useState("");
  const [duree, setDuree] = useState("24");
  const [pourTous, setPourTous] = useState(true);
  const [employes, setEmployes] = useState([]);
  const [ids, setIds] = useState(() => new Set());
  const [encours, setEncours] = useState([]);
  const [nbParRappel, setNbParRappel] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase
      .from("employes")
      .select("id, nom")
      .eq("entreprise_id", entrepriseId)
      .order("nom", { ascending: true })
      .then(({ data }) => setEmployes(data || []));
    charger();
  }, [entrepriseId]);

  async function charger() {
    const maintenant = new Date().toISOString();
    const { data } = await supabase.from("rappels").select("*").eq("entreprise_id", entrepriseId).gt("fin", maintenant).order("debut", { ascending: false });
    const liste = data || [];
    setEncours(liste);

    const personnalises = liste.filter((r) => !r.pour_tous).map((r) => r.id);
    if (personnalises.length > 0) {
      const { data: dests } = await supabase.from("rappel_destinataires").select("rappel_id").in("rappel_id", personnalises);
      const compte = {};
      for (const d of dests || []) compte[d.rappel_id] = (compte[d.rappel_id] || 0) + 1;
      setNbParRappel(compte);
    } else {
      setNbParRappel({});
    }
  }

  async function creer(e) {
    e.preventDefault();
    if (!contenu.trim() || busy || (!pourTous && ids.size === 0)) return;
    setBusy(true);
    setMsg(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/rappels", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ entrepriseId, contenu: contenu.trim(), dureeHeures: Number(duree), pourTous, employeIds: [...ids] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "La création a échoué." });
      } else {
        setContenu("");
        setIds(new Set());
        setMsg({ type: "ok", text: "Rappel créé. Les destinataires ont reçu une notification." });
        charger();
      }
    } catch {
      setMsg({ type: "err", text: "La création a échoué." });
    }
    setBusy(false);
  }

  async function retirer(id) {
    await supabase.from("rappels").delete().eq("id", id);
    charger();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Rappel</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            Fermer
          </button>
        </div>

        <p className="panel-hint">Un rappel mis en évidence en haut de l'app des personnes choisies, pendant la durée que tu veux (1 semaine au maximum).</p>

        <form onSubmit={creer}>
          <div className="field">
            <label>Rappel</label>
            <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={3} maxLength={400} placeholder="Ex: N'oubliez pas de signer la feuille d'inventaire." />
          </div>
          <div className="field">
            <label>Affiché pendant</label>
            <SimpleSelect options={DUREES} value={duree} onChange={setDuree} />
          </div>

          <div className="switch-row" style={{ marginBottom: "10px" }}>
            <div className="switch-row-text">
              <h4>Pour tout le monde</h4>
              <p>Décoche pour choisir les personnes.</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={pourTous} onChange={(e) => setPourTous(e.target.checked)} />
              <span className="switch-track"></span>
              <span className="switch-thumb"></span>
            </label>
          </div>

          {!pourTous && (
            <div className="moi-picker-list" style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "10px" }}>
              {employes.map((emp) => (
                <label className="moi-picker-row" key={emp.id} style={{ cursor: "pointer" }}>
                  <span>{emp.nom}</span>
                  <input
                    type="checkbox"
                    checked={ids.has(emp.id)}
                    onChange={() =>
                      setIds((prev) => {
                        const suivant = new Set(prev);
                        if (suivant.has(emp.id)) suivant.delete(emp.id);
                        else suivant.add(emp.id);
                        return suivant;
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}

          {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
          <button type="submit" className="submit-btn" disabled={busy || !contenu.trim() || (!pourTous && ids.size === 0)}>
            {busy ? "Création..." : "Créer le rappel"}
          </button>
        </form>

        {encours.length > 0 && (
          <div style={{ marginTop: "22px" }}>
            <h4 style={{ fontSize: "14.5px", fontWeight: 600 }}>En cours</h4>
            <div className="admin-list">
              {encours.map((r) => (
                <div className="admin-row" key={r.id}>
                  <div className="admin-row-main">
                    <div className="admin-row-title" style={{ whiteSpace: "normal" }}>{r.contenu}</div>
                    <div className="admin-row-sub">
                      {r.auteur_nom}
                      {r.anonyme ? " (anonyme pour les destinataires)" : ""} · {r.pour_tous ? "Pour tout le monde" : `Pour ${nbParRappel[r.id] || 0} personne(s)`} · jusqu'au{" "}
                      {new Date(r.fin).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <div className="admin-row-controls">
                    <button className="admin-icon-btn danger" onClick={() => retirer(r.id)}>
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
