"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PersonnalisationSection({ entrepriseId }) {
  const [modulesActifs, setModulesActifs] = useState([]);
  const [premierJourSemaine, setPremierJourSemaine] = useState("lundi");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const [{ data: actifsData }, { data: entrepriseData }] = await Promise.all([
      supabase.from("modules_actifs").select("module").eq("entreprise_id", entrepriseId),
      supabase.from("entreprises").select("premier_jour_semaine").eq("id", entrepriseId).maybeSingle(),
    ]);
    setModulesActifs((actifsData || []).map((m) => m.module));
    setPremierJourSemaine(entrepriseData?.premier_jour_semaine || "lundi");
    setLoading(false);
  }

  async function handleChangePremierJour(value) {
    setPremierJourSemaine(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("entreprises").update({ premier_jour_semaine: value }).eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: "L'enregistrement a échoué." } : { type: "ok", text: "Préférence enregistrée." });
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  const horaireActif = modulesActifs.includes("horaire");

  return (
    <div>
      <h2>Personnalisation</h2>
      <p className="panel-hint">Ajuste le comportement de tes modules actifs.</p>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {!horaireActif ? (
        <p className="section-hint">
          Active un module (ex: Horaire &amp; Pointage) pour voir apparaître ici ses options de personnalisation.
        </p>
      ) : (
        <div className="settings-section">
          <h3>Horaire &amp; Pointage</h3>
          <p className="section-hint">Le jour où commence chaque semaine dans l'Horaire et la Feuille de temps.</p>
          <div className="field" style={{ maxWidth: "220px" }}>
            <label>Premier jour de la semaine</label>
            <select
              value={premierJourSemaine}
              onChange={(e) => handleChangePremierJour(e.target.value)}
              disabled={saving}
            >
              <option value="lundi">Lundi</option>
              <option value="dimanche">Dimanche</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
