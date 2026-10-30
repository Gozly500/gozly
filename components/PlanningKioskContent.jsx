"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useLangue } from "@/components/moi/LangueContext";
import { NOM_CATEGORIE_COMMANDES, blocsTaches } from "@/lib/commandes";
import { IconCalendrier, IconLocalisation } from "@/components/icons/Pictogrammes";
import { Calendrier } from "@/components/saisie/PanneauxSaisie";

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PlanningKioskContent() {
  const router = useRouter();
  const { t: tr, langue } = useLangue();
  const [checking, setChecking] = useState(true);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [entrepriseNom, setEntrepriseNom] = useState("");
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [taches, setTaches] = useState([]);
  const [loadingTaches, setLoadingTaches] = useState(true);

  const storageKeyBase = "gozly_emplacement_id_";
  const [date, setDate] = useState(todayISO());
  const [calendrierOuvert, setCalendrierOuvert] = useState(false);

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

  // L'écran passe au jour suivant tout seul à minuit (seulement s'il affichait « aujourd'hui » : un autre jour choisi au calendrier reste).
  const aujourdhuiRef = useRef(todayISO());
  useEffect(() => {
    const id = setInterval(() => {
      const maintenant = todayISO();
      if (maintenant === aujourdhuiRef.current) return;
      const ancien = aujourdhuiRef.current;
      aujourdhuiRef.current = maintenant;
      setDate((d) => (d === ancien ? maintenant : d));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Un autre jour que celui d'aujourd'hui est abandonné après 10 minutes : l'écran du kiosque revient à aujourd'hui.
  useEffect(() => {
    if (date === todayISO()) return;
    const id = setTimeout(() => setDate(todayISO()), 10 * 60 * 1000);
    return () => clearTimeout(id);
  }, [date]);

  useEffect(() => {
    if (!entrepriseId) return;
    if (emplacements.length > 0 && !emplacementId) return; // en attente du choix
    loadTaches();
  }, [entrepriseId, emplacementId, date]);

  async function loadTaches() {
    setLoadingTaches(true);

    const { data: categoriesData } = await supabase
      .from("categories")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("ordre", { ascending: true })
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

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString(langue === "en" ? "en-CA" : "fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>{tr("kq.chargement")}</p>
      </div>
    );
  }

  if (!entrepriseId) {
    return (
      <div className="kiosk-screen">
        <p style={{ color: "var(--text-dim)" }}>{tr("kq.aucuneEntreprise")}</p>
      </div>
    );
  }

  if (emplacements.length > 0 && !emplacementId) {
    return (
      <div className="kiosk-screen">
        <div className="kiosk-inner">
          <h2>{tr("kq.p.empl")}</h2>
          <p className="panel-hint">{tr("kq.p.emplHint")}</p>
          <div className="modules-picker-grid" style={{ maxWidth: "360px", margin: "0 auto" }}>
            {emplacements.map((e) => (
              <button
                key={e.id}
                className="dashboard-picker-card"
                onClick={() => choisirEmplacement(e.id)}
                style={{ aspectRatio: "auto" }}
              >
                <div className="dashboard-picker-logo"><IconLocalisation className="gozly-icon" style={{ width: "58%", height: "58%" }} /></div>
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
      <div className="kiosk-inner kiosk-taches-inner">
        {entrepriseNom && <p className="kiosk-entreprise">{entrepriseNom}</p>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", flexWrap: "wrap", marginBottom: "24px" }}>
          <h2 style={{ textTransform: "capitalize", margin: 0 }}>{dateLabel}</h2>
          <button type="button" className="admin-icon-btn" onClick={() => setCalendrierOuvert(true)} aria-label={tr("kq.t.calendrier")}>
            <IconCalendrier className="gozly-icon" /> {tr("kq.t.calendrier")}
          </button>
          {date !== todayISO() && (
            <button type="button" className="admin-icon-btn" onClick={() => setDate(todayISO())}>
              {tr("kq.t.retourAujourdhui")}
            </button>
          )}
        </div>

        {calendrierOuvert && (
          <div className="modal-overlay" onClick={() => setCalendrierOuvert(false)}>
            {/* Le calendrier de Gozly (celui de la saisie des commandes), ici dans une fenêtre : on choisit un jour et ses tâches s'affichent. */}
            <div className="sg-panneau sg-autonome" onClick={(e) => e.stopPropagation()}>
              <div className="sg-interne">
                <Calendrier
                  champ={{ id: "jour-taches", label: tr("kq.t.choisirJour"), value: date, onChange: setDate }}
                  onFermer={() => setCalendrierOuvert(false)}
                  langue={langue}
                />
              </div>
            </div>
          </div>
        )}

        {loadingTaches ? (
          <p style={{ color: "var(--text-dim)" }}>{tr("kq.chargement")}</p>
        ) : categories.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>{tr("kq.t.aucuneCategorie")}</p>
        ) : (
          (() => {
            const boite = (cat) => {
              const catTaches = taches.filter((t) => t.categorie_id === cat.id);
              if (catTaches.length === 0) return null;
              return (
                <div className="planning-day kiosk-taches-boite" key={cat.id}>
                  <div className="planning-day-head">
                    <span className="planning-day-title">{cat.nom}</span>
                  </div>
                  {blocsTaches(catTaches, cat.nom === NOM_CATEGORIE_COMMANDES).map((bloc) => {
                    const lignes = bloc.rangees.map(({ tache: t, libelle }) => (
                      <label className="planning-tache" key={t.id}>
                        <input type="checkbox" checked={t.terminee} onChange={() => handleToggle(t)} />
                        <span className={`planning-tache-texte${t.terminee ? " done" : ""}`}>{libelle}</span>
                      </label>
                    ));
                    return bloc.titre ? (
                      <div className="planning-tache-boite" key={bloc.rangees[0].tache.id}>
                        <div className="planning-tache-groupe">{bloc.titre}</div>
                        {lignes}
                      </div>
                    ) : (
                      <Fragment key={bloc.rangees[0].tache.id}>{lignes}</Fragment>
                    );
                  })}
                </div>
              );
            };
            // Réservations (gérée par le module Commandes) à gauche ; les catégories
            // créées par le compte en colonnes à droite.
            const reservations = categories.find((c) => c.nom === NOM_CATEGORIE_COMMANDES);
            const autres = categories.filter((c) => c !== reservations);
            const boiteReservations = reservations ? boite(reservations) : null;
            return (
              <>
                <div className={`kiosk-taches-grille${boiteReservations ? " avec-reservations" : ""}`}>
                  {boiteReservations && <div className="kiosk-taches-reservations">{boiteReservations}</div>}
                  <div className="kiosk-taches-colonnes">{autres.map(boite)}</div>
                </div>
                {taches.length === 0 && (
                  <p style={{ color: "var(--text-dim)", textAlign: "center" }}>{tr(date === todayISO() ? "kq.t.aucuneTache" : "kq.t.aucuneTacheJour")}</p>
                )}
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}
