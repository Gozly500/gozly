"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EmplacementSelect from "@/components/EmplacementSelect";
import { getDebutSemaine, addDays } from "@/lib/semaine";
import { useGestion } from "@/components/gestion/GestionShell";

function dateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function heure(t) {
  return t ? t.slice(0, 5) : "";
}

// Horaire en lecture seule pour le téléphone : les quarts de la semaine, jour par jour.
// (Se construit et se modifie sur l'ordinateur.)
export default function HoraireMobile() {
  const { entrepriseId } = useGestion();
  const [weekStart, setWeekStart] = useState(() => getDebutSemaine(new Date()));
  const [employes, setEmployes] = useState([]);
  const [quarts, setQuarts] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementId] = useState(null); // null = toutes
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("emplacements")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setEmplacements(data || []));

    supabase
      .from("entreprises")
      .select("premier_jour_semaine")
      .eq("id", entrepriseId)
      .maybeSingle()
      .then(({ data }) => {
        const dimanche = data?.premier_jour_semaine === "dimanche";
        setWeekStart((w) => getDebutSemaine(addDays(w, 3), dimanche));
      });
  }, [entrepriseId]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    (async () => {
      const { data: employesData } = await supabase
        .from("employes")
        .select("id, nom")
        .eq("entreprise_id", entrepriseId)
        .order("nom", { ascending: true });

      let q = supabase
        .from("planning_quarts")
        .select("*")
        .eq("entreprise_id", entrepriseId)
        .gte("date", dateStr(weekStart))
        .lte("date", dateStr(addDays(weekStart, 6)))
        .order("heure_debut", { ascending: true });
      if (emplacementId) q = q.eq("emplacement_id", emplacementId);
      const { data: quartsData } = await q;

      if (ignore) return;
      setEmployes(employesData || []);
      setQuarts(quartsData || []);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [entrepriseId, weekStart, emplacementId]);

  const jours = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const aujourdhui = dateStr(new Date());
  const nomEmploye = (id) => employes.find((e) => e.id === id)?.nom || "Employé";
  const nomEmplacement = (id) => emplacements.find((e) => e.id === id)?.nom;

  const libelleSemaine = `${weekStart.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} - ${addDays(weekStart, 6).toLocaleDateString(
    "fr-CA",
    { day: "numeric", month: "long" }
  )}`;

  return (
    <div>
      <div className="moi-week-nav">
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          ‹
        </button>
        <span className="moi-week-label">{libelleSemaine}</span>
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          ›
        </button>
      </div>

      <EmplacementSelect emplacements={emplacements} value={emplacementId} onChange={setEmplacementId} includeToutes />

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : (
        <div className="gestion-cartes" style={{ marginTop: "12px" }}>
          {jours.map((d) => {
            const iso = dateStr(d);
            const duJour = quarts.filter((q) => q.date === iso);
            const titre = d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
            return (
              <div className={`planning-day gestion-jour-horaire${iso === aujourdhui ? " aujourdhui" : ""}`} key={iso}>
                <div className="gestion-jour-horaire-titre">{titre.charAt(0).toUpperCase() + titre.slice(1)}</div>
                {duJour.length === 0 ? (
                  <p className="moi-jour-repos" style={{ margin: 0 }}>
                    Aucun quart
                  </p>
                ) : (
                  duJour.map((q) => (
                    <div className="gestion-quart" key={q.id}>
                      <div className="gestion-quart-heures">
                        {heure(q.heure_debut)} – {heure(q.heure_fin)}
                      </div>
                      <div className="gestion-quart-qui">
                        <strong>{nomEmploye(q.employe_id)}</strong>
                        {(q.poste || (!emplacementId && emplacements.length > 1 && nomEmplacement(q.emplacement_id))) && (
                          <span className="gestion-quart-detail">
                            {[q.poste, !emplacementId && emplacements.length > 1 ? nomEmplacement(q.emplacement_id) : null].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        {!q.publie && <span className="gestion-brouillon">Brouillon</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
