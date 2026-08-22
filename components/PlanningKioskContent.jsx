"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PlanningKioskContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [entrepriseNom, setEntrepriseNom] = useState("");
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [taches, setTaches] = useState([]);
  const [loadingTaches, setLoadingTaches] = useState(true);

  const storageKeyBase = "gozly_emplacement_id_";
  const date = todayISO();

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profil } = await supabase
        .from("profils")
        .select("entreprise_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (ignore) return;

      if (profil?.entreprise_id) {
        setEntrepriseId(profil.entreprise_id);

        const [entrepriseRes, emplacementsRes] = await Promise.all([
          supabase.from("entreprises").select("nom").eq("id", profil.entreprise_id).maybeSingle(),
          supabase
            .from("emplacements")
            .select("*")
            .eq("entreprise_id", profil.entreprise_id)
            .order("created_at", { ascending: true }),
        ]);

        if (ignore) return;
        setEntrepriseNom(entrepriseRes.data?.nom || "");

        const list = emplacementsRes.data || [];
        setEmplacements(list);

        if (list.length > 0) {
          const saved = window.localStorage.getItem(storageKeyBase + profil.entreprise_id);
          if (saved && list.some((e) => e.id === saved)) setEmplacementId(saved);
        }
      }

      setChecking(false);
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  useEffect(() => {
    if (!entrepriseId) return;
    if (emplacements.length > 0 && !emplacementId) return; // en attente du choix
    loadTaches();
  }, [entrepriseId, emplacementId]);

  async function loadTaches() {
    setLoadingTaches(true);

    const { data: categoriesData } = await supabase
      .from("categories")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true });

    let query = supabase.from("taches").select("*").eq("entreprise_id", entrepriseId).eq("date", date);
    if (emplacementId) query = query.eq("emplacement_id", emplacementId);
    const { data: tachesData } = await query.order("created_at", { ascending: true });

    setCategories(categoriesData || []);
    setTaches(tachesData || []);
    setLoadingTaches(false);
  }

  function choisirEmplacement(id) {
    setEmplacementId(id);
    window.localStorage.setItem(storageKeyBase + entrepriseId, id);
  }

  async function handleToggle(tache) {
    setTaches((prev) => prev.map((t) => (t.id === tache.id ? { ...t, terminee: !t.terminee } : t)));
    await supabase.from("taches").update({ terminee: !tache.terminee }).eq("id", tache.id);
  }

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  if (!entrepriseId) {
    return (
      <div className="kiosk-screen">
        <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
      </div>
    );
  }

  if (emplacements.length > 0 && !emplacementId) {
    return (
      <div className="kiosk-screen">
        <div className="kiosk-inner">
          <h2>Quel emplacement ?</h2>
          <p className="panel-hint">Choisis la succursale de cette tablette (mémorisé pour la prochaine fois).</p>
          <div className="modules-picker-grid" style={{ maxWidth: "360px", margin: "0 auto" }}>
            {emplacements.map((e) => (
              <button
                key={e.id}
                className="dashboard-picker-card"
                onClick={() => choisirEmplacement(e.id)}
                style={{ aspectRatio: "auto" }}
              >
                <div className="dashboard-picker-logo">📍</div>
                <div className="dashboard-picker-nom">{e.nom}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-screen">
      <div className="kiosk-inner" style={{ maxWidth: "520px" }}>
        {entrepriseNom && <p className="kiosk-entreprise">{entrepriseNom}</p>}
        <h2 style={{ textTransform: "capitalize", marginBottom: "24px" }}>{dateLabel}</h2>

        {loadingTaches ? (
          <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
        ) : categories.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>Aucune catégorie configurée.</p>
        ) : (
          <div className="planning-days">
            {categories.map((cat) => {
              const catTaches = taches.filter((t) => t.categorie_id === cat.id);
              if (catTaches.length === 0) return null;

              return (
                <div className="planning-day" key={cat.id}>
                  <div className="planning-day-head">
                    <span className="planning-day-title">{cat.nom}</span>
                  </div>
                  {catTaches.map((t) => (
                    <label className="planning-tache" key={t.id}>
                      <input type="checkbox" checked={t.terminee} onChange={() => handleToggle(t)} />
                      <span className={`planning-tache-texte${t.terminee ? " done" : ""}`}>{t.texte}</span>
                    </label>
                  ))}
                </div>
              );
            })}
            {taches.length === 0 && (
              <p style={{ color: "var(--text-dim)", textAlign: "center" }}>Aucune tâche pour aujourd'hui.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
