"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EmplacementSelect from "@/components/EmplacementSelect";
import { getDebutSemaine, addDays } from "@/lib/semaine";
import SimpleSelect from "@/components/SimpleSelect";
import HoraireJour from "@/components/horaire/HoraireJour";
import HoraireTableau from "@/components/horaire/HoraireTableau";
import HoraireChrono from "@/components/horaire/HoraireChrono";
import { bloc } from "@/lib/horaireJour";
import { IconPlus as IconDupliquer, IconCrochet, IconTelecharger, IconEtoile, IconEtoilePleine, IconFlecheDroite, IconFlecheGauche, IconMegaphone } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

export default function HoraireSection({ entrepriseId }) {
  const { t } = useT();
  const [weekStart, setWeekStart] = useState(() => getDebutSemaine(new Date()));
  const [employes, setEmployes] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [quarts, setQuarts] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [rechercheEmploye, setRechercheEmploye] = useState("");
  const [modal, setModal] = useState(null); // { date, employeId, quartId, heureDebut, heureFin }
  const [publishing, setPublishing] = useState(false);
  const [importModal, setImportModal] = useState(null); // { semaineSource, confirmerRemplacement, error }
  const [importing, setImporting] = useState(false);
  const [favoris, setFavoris] = useState([]); // dates ISO (semaine_debut) marquées favorites
  const [favoriMsg, setFavoriMsg] = useState(null);
  const [jourOuvert, setJourOuvert] = useState(null); // date ISO de la journée affichée en blocs (null = semaine)
  const [confirmation, setConfirmation] = useState(null); // { titre, bouton, action }
  const [copie, setCopie] = useState(null); // quart à dupliquer : { employeId, heureDebut, heureFin }

  // Échap termine la duplication ; changer de succursale aussi.
  useEffect(() => {
    if (!copie) return;
    const touche = (e) => e.key === "Escape" && setCopie(null);
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [copie]);
  useEffect(() => setCopie(null), [entrepriseId, emplacementId]);

  const MAX_FAVORIS = 3;

  // Modèle d'affichage choisi dans Modules (colonne de horaire_modele.sql, absente tant que le SQL n'est pas exécuté : classique).
  const [modele, setModele] = useState("classique");
  useEffect(() => {
    supabase
      .from("entreprises")
      .select("horaire_modele")
      .eq("id", entrepriseId)
      .maybeSingle()
      .then(({ data }) => setModele(data?.horaire_modele || "classique"));
  }, [entrepriseId]);

  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    supabase
      .from("emplacements")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setEmplacements(data || []);
        if (data && data.length > 0) setEmplacementId((cur) => cur || data[0].id);
      });
  }, [entrepriseId]);

  useEffect(() => {
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
    load();
  }, [entrepriseId, weekStart, emplacementId]);

  useEffect(() => {
    if (!entrepriseId) return;
    chargerFavoris();
  }, [entrepriseId, emplacementId]);

  async function chargerFavoris() {
    let q = supabase.from("horaire_semaines_favorites").select("semaine_debut").eq("entreprise_id", entrepriseId);
    q = emplacements.length > 0 ? q.eq("emplacement_id", emplacementId) : q.is("emplacement_id", null);
    const { data } = await q;
    setFavoris((data || []).map((f) => f.semaine_debut));
  }

  async function toggleFavori(iso) {
    setFavoriMsg(null);
    const estFavori = favoris.includes(iso);

    if (!estFavori && favoris.length >= MAX_FAVORIS) {
      setFavoriMsg(t("Maximum {max} semaines en favoris - retires-en une avant d'en ajouter une nouvelle.", { max: MAX_FAVORIS }));
      return;
    }

    if (estFavori) {
      let q = supabase.from("horaire_semaines_favorites").delete().eq("entreprise_id", entrepriseId).eq("semaine_debut", iso);
      q = emplacements.length > 0 ? q.eq("emplacement_id", emplacementId) : q.is("emplacement_id", null);
      await q;
      setFavoris((f) => f.filter((d) => d !== iso));
    } else {
      await supabase.from("horaire_semaines_favorites").insert({
        entreprise_id: entrepriseId,
        emplacement_id: emplacements.length > 0 ? emplacementId : null,
        semaine_debut: iso,
      });
      setFavoris((f) => [...f, iso]);
    }
  }

  // discret : relit sans afficher « Chargement... » (après un déplacement ou une duplication).
  async function load(discret = false) {
    if (!discret) setLoading(true);
    const { data: employesData } = await supabase
      .from("employes")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("nom", { ascending: true });

    let quartsQuery = supabase
      .from("planning_quarts")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date", toISODate(weekStart))
      .lte("date", toISODate(weekEnd))
      .order("heure_debut", { ascending: true });

    quartsQuery = emplacements.length > 0 ? quartsQuery.eq("emplacement_id", emplacementId) : quartsQuery;

    const { data: quartsData } = await quartsQuery;

    if (employesData && employesData.length > 0) {
      const { data: assocData } = await supabase
        .from("employe_emplacements")
        .select("*")
        .in("employe_id", employesData.map((e) => e.id));
      setAssociations(assocData || []);
    } else {
      setAssociations([]);
    }

    setEmployes(employesData || []);
    setQuarts(quartsData || []);
    setLoading(false);
  }

  function employeNom(id) {
    return employes.find((e) => e.id === id)?.nom || t("Employé retiré");
  }

  // Un employé sans aucun emplacement assigné est considéré disponible
  // partout. Un employé avec des emplacements assignés n'apparaît que
  // dans ceux-là.
  const employesVisibles =
    emplacements.length === 0 || !emplacementId
      ? employes
      : employes.filter((emp) => {
          const assignes = associations.filter((a) => a.employe_id === emp.id).map((a) => a.emplacement_id);
          return assignes.length === 0 || assignes.includes(emplacementId);
        });

  // Filtre de recherche : ne change que la liste des pastilles à glisser,
  // pas les options d'employé du formulaire d'ajout/édition d'un quart.
  const employesAffiches = rechercheEmploye.trim()
    ? employesVisibles.filter((e) => e.nom.toLowerCase().includes(rechercheEmploye.trim().toLowerCase()))
    : employesVisibles;

  // Quart glissé sur une autre case (ou une autre journée) : il change de date et/ou d'employé.
  async function deplacerQuart(quartId, date, employeId = null) {
    const q = quarts.find((x) => x.id === quartId);
    if (!q) return;
    const maj = { date, employe_id: employeId || q.employe_id };
    if (maj.date === q.date && maj.employe_id === q.employe_id) return;
    setQuarts((liste) => liste.map((x) => (x.id === quartId ? { ...x, ...maj } : x)));
    await supabase.from("planning_quarts").update(maj).eq("id", quartId);
    load(true);
  }

  // Duplication : seules les heures sont copiées, une fois, dans la case choisie (en brouillon).
  async function collerQuart(date, employeId) {
    setCopie(null);
    await supabase.from("planning_quarts").insert({
      entreprise_id: entrepriseId,
      employe_id: employeId,
      date,
      heure_debut: copie.heureDebut,
      heure_fin: copie.heureFin,
      poste: null,
      emplacement_id: emplacementId,
    });
    load(true);
  }

  // Chronologie : nouvelles heures (ou nouvelle personne) d'un bloc étiré ou déplacé.
  async function changerHeures(quart, maj) {
    const pareil = maj.heure_debut === quart.heure_debut.slice(0, 5) && maj.heure_fin === quart.heure_fin.slice(0, 5) && maj.employe_id === quart.employe_id;
    if (pareil) return;
    setQuarts((liste) => liste.map((x) => (x.id === quart.id ? { ...x, ...maj } : x)));
    await supabase.from("planning_quarts").update(maj).eq("id", quart.id);
    load(true);
  }

  // Chronologie : un quart peint en glissant est créé tout de suite (en brouillon).
  async function creerQuart(employeId, date, heureDebut, heureFin) {
    await supabase.from("planning_quarts").insert({
      entreprise_id: entrepriseId,
      employe_id: employeId,
      date,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      poste: null,
      emplacement_id: emplacementId,
    });
    load(true);
  }

  async function supprimerQuart(quart) {
    setQuarts((liste) => liste.filter((x) => x.id !== quart.id));
    await supabase.from("planning_quarts").delete().eq("id", quart.id);
    load(true);
  }

  async function effacerJour(date) {
    const ids = quarts.filter((q) => q.date === date).map((q) => q.id);
    if (ids.length > 0) await supabase.from("planning_quarts").delete().in("id", ids);
  }

  // Confirmation dans une fenêtre de Gozly (celle du navigateur peut être bloquée et répondre « non » sans rien afficher).
  function viderJour(date) {
    if (!quarts.some((q) => q.date === date)) return;
    setConfirmation({
      titre: t("Retirer tous les quarts de cette journée ?"),
      bouton: t("Retirer"),
      action: async () => {
        await effacerJour(date);
        load(true);
      },
    });
  }

  // Copie tous les quarts d'une journée sur une autre (en brouillon), en remplaçant ce qu'elle contenait.
  function copierJour(source, cible) {
    const aCopier = quarts.filter((q) => q.date === source);
    if (aCopier.length === 0) return;
    if (!quarts.some((q) => q.date === cible)) return ecrireCopie(aCopier, cible);
    setConfirmation({
      titre: t("Remplacer les quarts de la journée choisie ?"),
      bouton: t("Remplacer"),
      action: async () => {
        await effacerJour(cible);
        await ecrireCopie(aCopier, cible);
      },
    });
  }

  async function ecrireCopie(aCopier, cible) {
    await supabase.from("planning_quarts").insert(
      aCopier.map((q) => ({
        entreprise_id: entrepriseId,
        employe_id: q.employe_id,
        date: cible,
        heure_debut: q.heure_debut,
        heure_fin: q.heure_fin,
        poste: q.poste,
        emplacement_id: q.emplacement_id,
        publie: false,
      })),
    );
    load(true);
  }

  function dupliquerQuart() {
    setCopie({ employeId: modal.employeId, heureDebut: modal.heureDebut, heureFin: modal.heureFin });
    setModal(null);
  }

  // Toucher un quart l'ouvre toujours (et abandonne la duplication en cours) : seule une case vide reçoit la copie.
  const toucherQuart = (q) => {
    setCopie(null);
    openEdit(q);
  };

  function handleDrop(e, dateISO) {
    e.preventDefault();
    setDragOverDate(null);
    const quartId = e.dataTransfer.getData("application/x-quart");
    if (quartId) {
      deplacerQuart(quarts.find((q) => String(q.id) === quartId)?.id, dateISO);
      return;
    }
    const employeId = e.dataTransfer.getData("text/plain");
    if (!employeId) return;
    setModal({ date: dateISO, employeId, quartId: null, heureDebut: "09:00", heureFin: "17:00", poste: "" });
  }

  // Jour précédent / suivant dans la vue journée (change de semaine au besoin).
  function changerJour(pas) {
    const jour = addDays(new Date(`${jourOuvert}T00:00:00`), pas);
    const iso = toISODate(jour);
    if (iso < toISODate(weekStart)) setWeekStart((w) => addDays(w, -7));
    else if (iso > toISODate(weekEnd)) setWeekStart((w) => addDays(w, 7));
    setJourOuvert(iso);
  }

  // « 3 personnes · 21,5 h » sous la date de chaque colonne.
  function resumeJour(liste) {
    if (liste.length === 0) return t("Personne");
    const n = new Set(liste.map((q) => q.employe_id)).size;
    const heures = liste.reduce((s, q) => s + bloc(q).a - bloc(q).de, 0) / 60;
    return t("{n} pers. · {h} h", { n, h: heures.toLocaleString(loc(), { maximumFractionDigits: 1 }) });
  }

  function openAddViaButton(dateISO) {
    setModal({
      date: dateISO,
      employeId: employesVisibles[0]?.id || "",
      quartId: null,
      heureDebut: "09:00",
      heureFin: "17:00",
      poste: "",
    });
  }

  function openEdit(quart) {
    setModal({
      date: quart.date,
      employeId: quart.employe_id,
      quartId: quart.id,
      heureDebut: quart.heure_debut.slice(0, 5),
      heureFin: quart.heure_fin.slice(0, 5),
      poste: quart.poste || "",
    });
  }

  async function handleSaveModal(e) {
    e.preventDefault();
    if (!modal.employeId) return;

    const poste = modal.poste?.trim() || null;

    if (modal.quartId) {
      await supabase
        .from("planning_quarts")
        .update({ employe_id: modal.employeId, heure_debut: modal.heureDebut, heure_fin: modal.heureFin, poste })
        .eq("id", modal.quartId);
    } else {
      await supabase.from("planning_quarts").insert({
        entreprise_id: entrepriseId,
        employe_id: modal.employeId,
        date: modal.date,
        heure_debut: modal.heureDebut,
        heure_fin: modal.heureFin,
        poste,
        emplacement_id: emplacementId,
      });
    }

    setModal(null);
    load();
  }

  async function handleDeleteModal() {
    if (!modal.quartId) return;
    await supabase.from("planning_quarts").delete().eq("id", modal.quartId);
    setModal(null);
    load();
  }

  async function handlePublierSemaine() {
    setPublishing(true);
    let query = supabase
      .from("planning_quarts")
      .update({ publie: true })
      .eq("entreprise_id", entrepriseId)
      .gte("date", toISODate(weekStart))
      .lte("date", toISODate(weekEnd));
    if (emplacements.length > 0) query = query.eq("emplacement_id", emplacementId);
    await query;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    fetch("/api/notifications/semaine-publiee", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        entrepriseId,
        dateDebut: toISODate(weekStart),
        dateFin: toISODate(weekEnd),
        emplacementId: emplacements.length > 0 ? emplacementId : null,
      }),
    }).catch(() => {});

    setPublishing(false);
    load();
  }

  // Les 8 semaines précédant celle affichée, la plus récente en premier -
  // plus simple à choisir qu'à saisir une date à la main. Une semaine mise
  // en favori reste dans la liste même si elle est plus vieille que ça.
  const huitDernieres = Array.from({ length: 8 }, (_, i) => addDays(weekStart, -7 * (i + 1)));
  const isoHuitDernieres = new Set(huitDernieres.map(toISODate));
  const semainesFavoritesHorsFenetre = favoris
    .filter((iso) => iso !== toISODate(weekStart) && !isoHuitDernieres.has(iso))
    .map((iso) => new Date(`${iso}T00:00:00`));
  const semainesRecentes = [...huitDernieres, ...semainesFavoritesHorsFenetre].sort((a, b) => b - a);

  function openImportModal() {
    setFavoriMsg(null);
    setImportModal({ semaineSource: toISODate(semainesRecentes[0]), confirmerRemplacement: false, error: null });
  }

  async function handleImporterSemaine(e) {
    e.preventDefault();
    if (!importModal?.semaineSource) return;

    const sourceWeekStart = new Date(`${importModal.semaineSource}T00:00:00`);
    const sourceWeekEnd = addDays(sourceWeekStart, 6);

    // La semaine affichée a déjà des quarts : on demande une confirmation
    // explicite avant de les remplacer, plutôt que d'empiler les deux.
    if (quarts.length > 0 && !importModal.confirmerRemplacement) {
      setImportModal((m) => ({ ...m, confirmerRemplacement: true, error: null }));
      return;
    }

    setImporting(true);
    setImportModal((m) => ({ ...m, error: null }));

    let sourceQuery = supabase
      .from("planning_quarts")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date", toISODate(sourceWeekStart))
      .lte("date", toISODate(sourceWeekEnd));
    sourceQuery = emplacements.length > 0 ? sourceQuery.eq("emplacement_id", emplacementId) : sourceQuery;
    const { data: quartsSource } = await sourceQuery;

    if (!quartsSource || quartsSource.length === 0) {
      setImporting(false);
      setImportModal((m) => ({ ...m, error: t("Aucun quart trouvé pour cette semaine-là.") }));
      return;
    }

    if (quarts.length > 0) {
      let delQuery = supabase
        .from("planning_quarts")
        .delete()
        .eq("entreprise_id", entrepriseId)
        .gte("date", toISODate(weekStart))
        .lte("date", toISODate(weekEnd));
      delQuery = emplacements.length > 0 ? delQuery.eq("emplacement_id", emplacementId) : delQuery;
      await delQuery;
    }

    const copies = quartsSource.map((q) => {
      const decalageJours = Math.round((new Date(q.date) - sourceWeekStart) / 86400000);
      return {
        entreprise_id: entrepriseId,
        employe_id: q.employe_id,
        date: toISODate(addDays(weekStart, decalageJours)),
        heure_debut: q.heure_debut,
        heure_fin: q.heure_fin,
        poste: q.poste,
        emplacement_id: q.emplacement_id,
        publie: false,
      };
    });

    await supabase.from("planning_quarts").insert(copies);

    setImporting(false);
    setImportModal(null);
    load();
  }

  const weekLabel = `${weekStart.toLocaleDateString(loc(), { day: "numeric", month: "long" })} - ${weekEnd.toLocaleDateString(
    loc(),
    { day: "numeric", month: "long", year: "numeric" }
  )}`;

  return (
    <div>
      <EmplacementSelect emplacements={emplacements} value={emplacementId} onChange={setEmplacementId} />

      <div className="planning-week-nav">
        <button className="admin-icon-btn" onClick={() => { setJourOuvert(null); setWeekStart((w) => addDays(w, -7)); }}>
          <IconFlecheGauche className="gozly-icon" />{" "}{t("Semaine précédente")}
        </button>
        <span className="planning-week-label">{weekLabel}</span>
        <button className="admin-icon-btn" onClick={() => { setJourOuvert(null); setWeekStart((w) => addDays(w, 7)); }}>
          {t("Semaine suivante")}{" "}<IconFlecheDroite className="gozly-icon" />
        </button>
        <button
          className="admin-icon-btn"
          title={favoris.includes(toISODate(weekStart)) ? t("Retirer des favoris") : t("Garder cette semaine en favori (accessible même après 8 semaines)")}
          onClick={() => toggleFavori(toISODate(weekStart))}
        >
          {favoris.includes(toISODate(weekStart)) ? <IconEtoilePleine className="gozly-icon" /> : <IconEtoile className="gozly-icon" />}
        </button>
        <button className="admin-icon-btn" style={{ marginLeft: "auto" }} onClick={openImportModal}>
          <IconTelecharger className="gozly-icon" />{" "}{t("Importer une semaine")}
        </button>
        <button
          className="submit-btn"
          onClick={handlePublierSemaine}
          disabled={publishing || quarts.length === 0 || quarts.every((q) => q.publie)}
        >
          {publishing ? t("Publication...") : <><IconMegaphone className="gozly-icon" />{" "}{t("Publier la semaine")}</>}
        </button>
      </div>
      {favoriMsg && (
        <p className="settings-msg err" style={{ marginBottom: "10px" }}>
          {favoriMsg}
        </p>
      )}

      {copie && (
        <div className="horaire-copie">
          <IconDupliquer className="gozly-icon" />
          <strong>{copie.heureDebut} - {copie.heureFin}</strong>
          <button type="button" className="admin-icon-btn" onClick={() => setCopie(null)}>
            {t("Annuler")}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>
      ) : employes.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>
          {t("Ajoute d'abord des employés dans Entreprise → Employés pour pouvoir les placer dans l'horaire.")}
        </p>
      ) : employesVisibles.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>{t("Aucun employé assigné à cet emplacement pour l'instant.")}</p>
      ) : jourOuvert ? (
        <HoraireJour
          date={jourOuvert}
          // Les employés de la succursale, plus ceux qui ont un quart ce jour-là sans y être assignés.
          employes={employes.filter((e) => employesVisibles.includes(e) || quarts.some((q) => q.date === jourOuvert && q.employe_id === e.id))}
          quarts={quarts.filter((q) => q.date === jourOuvert)}
          onRetour={() => setJourOuvert(null)}
          onJour={changerJour}
          onAjouter={(employeId, heureDebut, heureFin) =>
            copie ? collerQuart(jourOuvert, employeId) : setModal({ date: jourOuvert, employeId, quartId: null, heureDebut, heureFin, poste: "" })
          }
          onModifier={toucherQuart}
        />
      ) : modele === "chronologie" ? (
        <HoraireChrono
          jours={weekDays.map((day) => ({
            iso: toISODate(day),
            nom: t(JOURS[(day.getDay() + 6) % 7]),
            date: day.toLocaleDateString(loc(), { day: "numeric", month: "short" }),
          }))}
          employes={[...employesAffiches, ...(rechercheEmploye.trim() ? [] : employes.filter((e) => !employesVisibles.includes(e) && quarts.some((q) => q.employe_id === e.id)))]}
          quarts={quarts}
          recherche={rechercheEmploye}
          onRecherche={setRechercheEmploye}
          // peint : créé directement ; simple clic : le formulaire s'ouvre. Pendant une duplication, les heures copiées sont collées.
          onAjouter={(employeId, date, heureDebut, heureFin, peint) => {
            if (copie) collerQuart(date, employeId);
            else if (peint) creerQuart(employeId, date, heureDebut, heureFin);
            else setModal({ date, employeId, quartId: null, heureDebut, heureFin, poste: "" });
          }}
          onModifier={toucherQuart}
          onHeures={changerHeures}
          onSupprimer={supprimerQuart}
          onCopierJour={copierJour}
          onViderJour={viderJour}
        />
      ) : modele === "tableau" ? (
        <HoraireTableau
          jours={weekDays.map((day) => ({
            iso: toISODate(day),
            nom: t(JOURS[(day.getDay() + 6) % 7]),
            date: day.toLocaleDateString(loc(), { day: "numeric", month: "short" }),
          }))}
          // Les employés de la succursale (selon la recherche), plus ceux qui ont un quart cette semaine sans y être assignés.
          employes={[...employesAffiches, ...(rechercheEmploye.trim() ? [] : employes.filter((e) => !employesVisibles.includes(e) && quarts.some((q) => q.employe_id === e.id)))]}
          quarts={quarts}
          recherche={rechercheEmploye}
          onRecherche={setRechercheEmploye}
          onAjouter={(employeId, date) =>
            copie ? collerQuart(date, employeId) : setModal({ date, employeId, quartId: null, heureDebut: "09:00", heureFin: "17:00", poste: "" })
          }
          onModifier={toucherQuart}
          onDeplacer={deplacerQuart}
          onJour={setJourOuvert}
        />
      ) : (
        <>
          <div className="horaire-layout">
            <div className="horaire-employees">
              <div className="horaire-employee-search">
                <input
                  type="text"
                  value={rechercheEmploye}
                  onChange={(e) => setRechercheEmploye(e.target.value)}
                  placeholder={t("Rechercher...")}
                />
              </div>
              {employesAffiches.map((emp) => (
                <div
                  key={emp.id}
                  className="horaire-employee-pill"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", emp.id)}
                >
                  {emp.nom}
                </div>
              ))}
              {employesAffiches.length === 0 && (
                <p className="section-hint" style={{ padding: "0 4px" }}>
                  {t("Aucun employé trouvé.")}
                </p>
              )}
            </div>

            <div className="horaire-grid">
              {weekDays.map((day) => {
                const dateISO = toISODate(day);
                const dayQuarts = quarts.filter((q) => q.date === dateISO);

                return (
                  <div
                    key={dateISO}
                    className={`horaire-col${dragOverDate === dateISO ? " drag-over" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverDate(dateISO);
                    }}
                    onDragLeave={() => setDragOverDate((d) => (d === dateISO ? null : d))}
                    onDrop={(e) => handleDrop(e, dateISO)}
                    onClick={(e) => {
                      // Duplication : le formulaire s'ouvre avec les heures copiées, pour choisir la personne.
                      if (copie) {
                        setModal({ date: dateISO, employeId: copie.employeId, quartId: null, heureDebut: copie.heureDebut, heureFin: copie.heureFin, poste: "" });
                        setCopie(null);
                      } else if (e.target === e.currentTarget) setJourOuvert(dateISO);
                    }}
                  >
                    <button type="button" className="horaire-col-head" title={t("Voir la journée en blocs")} onClick={() => setJourOuvert(dateISO)}>
                      <div className="horaire-col-day">{t(JOURS[(day.getDay() + 6) % 7])}</div>
                      <div className="horaire-col-date">{day.toLocaleDateString(loc(), { day: "numeric", month: "short" })}</div>
                      <div className="horaire-col-resume">{resumeJour(dayQuarts)}</div>
                    </button>

                    {dayQuarts.map((q) => (
                      <div
                        className={`horaire-chip${q.publie ? "" : " brouillon"}`}
                        key={q.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("application/x-quart", String(q.id))}
                        onClick={(e) => {
                          e.stopPropagation();
                          toucherQuart(q);
                        }}
                      >
                        <div className="horaire-chip-nom">
                          {employeNom(q.employe_id)}
                          {!q.publie && <span className="horaire-chip-badge">{t("Brouillon")}</span>}
                          {q.echange_de && (
                            <span className="horaire-chip-badge horaire-chip-echange" title={t("Quart reçu de {nom} par échange", { nom: employeNom(q.echange_de) })}>
                              {t("Échange")}
                            </span>
                          )}
                        </div>
                        <div className="horaire-chip-heures">
                          {q.heure_debut.slice(0, 5)} - {q.heure_fin.slice(0, 5)}
                        </div>
                        {q.poste && <div className="horaire-chip-poste">{q.poste}</div>}
                      </div>
                    ))}

                    <button className="horaire-col-add" onClick={() => openAddViaButton(dateISO)}>
                      {t("+ Ajouter")}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" style={{ maxWidth: "360px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal.quartId ? t("Modifier le quart") : t("Nouveau quart")}</h3>
              <button className="admin-icon-btn" onClick={() => setModal(null)}>
                {t("Fermer")}
              </button>
            </div>
            <form onSubmit={handleSaveModal}>
              <div className="field">
                <label>{t("Employé")}</label>
                {modal.quartId || employes.find((e) => e.id === modal.employeId) ? (
                  <SimpleSelect
                    options={(employesVisibles.some((e) => e.id === modal.employeId)
                      ? employesVisibles
                      : [...employesVisibles, employes.find((e) => e.id === modal.employeId)].filter(Boolean)
                    ).map((emp) => ({ id: emp.id, label: emp.nom }))}
                    value={modal.employeId}
                    onChange={(id) => setModal((m) => ({ ...m, employeId: id }))}
                  />
                ) : (
                  <div style={{ fontWeight: 600 }}>{employeNom(modal.employeId)}</div>
                )}
              </div>
              <div className="field-row">
                <div className="field">
                  <label>{t("Début")}</label>
                  <input
                    type="time"
                    value={modal.heureDebut}
                    onChange={(e) => setModal((m) => ({ ...m, heureDebut: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>{t("Fin")}</label>
                  <input
                    type="time"
                    value={modal.heureFin}
                    onChange={(e) => setModal((m) => ({ ...m, heureFin: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label>{t("Poste (optionnel)")}</label>
                <input
                  type="text"
                  value={modal.poste}
                  onChange={(e) => setModal((m) => ({ ...m, poste: e.target.value }))}
                  placeholder={t("Ex: Machine 3, Cuisine, Caisse...")}
                />
              </div>
              <div className="admin-edit-actions">
                <button type="submit" className="submit-btn">
                  {modal.quartId ? t("Enregistrer") : t("Ajouter")}
                </button>
                {modal.quartId && (
                  <button type="button" className="admin-icon-btn" onClick={dupliquerQuart}>
                    <IconDupliquer className="gozly-icon" />{" "}{t("Dupliquer")}
                  </button>
                )}
                {modal.quartId && (
                  <button type="button" className="btn-danger" onClick={handleDeleteModal}>
                    {t("Retirer ce quart")}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmation && (
        <div className="modal-overlay" onClick={() => setConfirmation(null)}>
          <div className="modal-card" style={{ maxWidth: "360px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{confirmation.titre}</h3>
            </div>
            <div className="admin-edit-actions">
              <button
                type="button"
                className="submit-btn"
                onClick={() => {
                  setConfirmation(null);
                  confirmation.action();
                }}
              >
                {confirmation.bouton}
              </button>
              <button type="button" className="admin-icon-btn" onClick={() => setConfirmation(null)}>
                {t("Annuler")}
              </button>
            </div>
          </div>
        </div>
      )}

      {importModal && (
        <div className="modal-overlay" onClick={() => !importing && setImportModal(null)}>
          <div className="modal-card" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("Importer une semaine")}</h3>
              <button className="admin-icon-btn" onClick={() => setImportModal(null)} disabled={importing}>
                {t("Fermer")}
              </button>
            </div>
            <form onSubmit={handleImporterSemaine}>
              <div className="field">
                <label>{t("Semaine à copier")}</label>
                <div className="admin-list" style={{ maxHeight: "260px", overflowY: "auto" }}>
                  {semainesRecentes.map((debut) => {
                    const iso = toISODate(debut);
                    const fin = addDays(debut, 6);
                    const selectionne = importModal.semaineSource === iso;
                    const estFavori = favoris.includes(iso);
                    return (
                      <div
                        key={iso}
                        className="admin-row"
                        style={{ cursor: "pointer", background: selectionne ? "rgba(122,63,224,0.16)" : undefined }}
                        onClick={() => setImportModal((m) => ({ ...m, semaineSource: iso, confirmerRemplacement: false, error: null }))}
                      >
                        <div className="admin-row-main">
                          <div className="admin-row-title">
                            {selectionne ? <><IconCrochet className="gozly-icon" /> </> : ""}
                            {debut.toLocaleDateString(loc(), { day: "numeric", month: "short" })} –{" "}
                            {fin.toLocaleDateString(loc(), { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          title={estFavori ? t("Retirer des favoris") : t("Garder en favori")}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavori(iso);
                          }}
                        >
                          {estFavori ? <IconEtoilePleine className="gozly-icon" /> : <IconEtoile className="gozly-icon" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {favoriMsg && <p className="settings-msg err">{favoriMsg}</p>}
              {importModal.confirmerRemplacement && (
                <p className="settings-msg err">
                  {t("La semaine affichée a déjà des quarts - ils seront tous supprimés et remplacés par la copie. Clique à nouveau sur \"Importer\" pour confirmer.")}
                </p>
              )}
              {importModal.error && <p className="settings-msg err">{importModal.error}</p>}

              <div className="admin-edit-actions">
                <button type="submit" className="submit-btn" disabled={importing}>
                  {importing ? t("Importation...") : importModal.confirmerRemplacement ? t("Confirmer le remplacement") : t("Importer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
