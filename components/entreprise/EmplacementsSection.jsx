"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { geocoderAdresse } from "@/lib/geocode";
import { IconAttention, IconCrochet } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";

// Jours dans l'ordre d'affichage ; l'id est le numéro de jour JS (0 = dimanche).
const JOURS_OUVERTURE = [
  { id: "1", label: "Lundi" },
  { id: "2", label: "Mardi" },
  { id: "3", label: "Mercredi" },
  { id: "4", label: "Jeudi" },
  { id: "5", label: "Vendredi" },
  { id: "6", label: "Samedi" },
  { id: "0", label: "Dimanche" },
];

export default function EmplacementsSection({ entrepriseId }) {
  const { t } = useT();
  const [horairesModal, setHorairesModal] = useState(null); // { emp, draft: { "1": { ouvert, debut, fin }, ... } }
  const [horairesSaving, setHorairesSaving] = useState(false);
  // Lien avec une succursale Wix : les commandes de ce lieu Wix vont à cette succursale (et à elle seule).
  const [lieuxWix, setLieuxWix] = useState([]); // lieux Wix vus dans les commandes déjà reçues
  const [lienModal, setLienModal] = useState(null); // { emp }
  const [lienMsg, setLienMsg] = useState(null);
  const [lienSaving, setLienSaving] = useState(false);

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
    const { data: lieux } = await supabase
      .from("commandes_en_ligne")
      .select("lieu_nom")
      .eq("entreprise_id", entrepriseId)
      .eq("source", "wix")
      .not("lieu_nom", "is", null)
      .limit(1000);
    setLieuxWix([...new Set((lieux || []).map((l) => l.lieu_nom))].sort((a, b) => a.localeCompare(b, "fr")));
    setLoading(false);
  }

  async function lierLieu(emp, lieu) {
    setLienSaving(true);
    setLienMsg(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch("/api/wix/emplacement-lieu", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
        body: JSON.stringify({ entrepriseId, emplacementId: emp.id, lieu: lieu || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLienMsg({ type: "err", text: data.error || t("L'enregistrement a échoué.") });
      } else {
        setLienModal(null);
        await load();
      }
    } catch {
      setLienMsg({ type: "err", text: t("L'enregistrement a échoué.") });
    }
    setLienSaving(false);
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

  function ouvrirHoraires(emp) {
    const draft = {};
    for (const j of JOURS_OUVERTURE) {
      const h = emp.horaires_ouverture?.[j.id];
      draft[j.id] = { ouvert: !!h, debut: h?.debut || "09:00", fin: h?.fin || "17:00" };
    }
    setHorairesModal({ emp, draft });
  }

  async function enregistrerHoraires(e) {
    e.preventDefault();
    setHorairesSaving(true);
    const horaires = {};
    for (const j of JOURS_OUVERTURE) {
      const h = horairesModal.draft[j.id];
      if (h.ouvert && h.debut && h.fin) horaires[j.id] = { debut: h.debut, fin: h.fin };
    }
    await supabase
      .from("emplacements")
      .update({ horaires_ouverture: Object.keys(horaires).length > 0 ? horaires : null })
      .eq("id", horairesModal.emp.id);
    setHorairesSaving(false);
    setHorairesModal(null);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("emplacements").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>;
  }

  return (
    <div>
      <h2>{t("Emplacements")}</h2>
      <p className="panel-hint">
        {t("Tes succursales. Dès qu'il y en a plus d'une, l'Horaire et le Pointage se gèrent séparément pour chacune. Ajoute une adresse pour activer le pointage mobile (GPS) pour les employés qui y sont assignés (à activer dans Personnalisation > Horaire & Pointage).")}
      </p>

      <div className="admin-list" style={{ marginBottom: "20px", maxWidth: "500px" }}>
        {emplacements.map((emp) => (
          <div className="admin-row" key={emp.id}>
            {editingId === emp.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                <input type="text" value={editNom} onChange={(e) => setEditNom(e.target.value)} placeholder={t("Nom")} />
                <input
                  type="text"
                  value={editAdresse}
                  onChange={(e) => setEditAdresse(e.target.value)}
                  placeholder={t("Adresse (optionnel)")}
                />
              </div>
            ) : (
              <div className="admin-row-main">
                <div className="admin-row-title">{emp.nom}</div>
                {emp.wix_lieu_nom && <div className="admin-row-sub">{t("Reçoit les commandes Wix de :")} {emp.wix_lieu_nom}</div>}
                {emp.adresse && (
                  <div className="admin-row-sub">
                    {emp.adresse}
                    {emp.latitude == null && <> — <IconAttention className="gozly-icon" />{" "}{t("position introuvable, pointage mobile indisponible")}</>}
                  </div>
                )}
              </div>
            )}

            <div className="admin-row-controls">
              {editingId === emp.id ? (
                <>
                  <button className="admin-icon-btn" onClick={() => handleSaveEdit(emp.id)} disabled={geocodage}>
                    {geocodage ? t("Localisation...") : t("Enregistrer")}
                  </button>
                  <button className="admin-icon-btn" onClick={() => setEditingId(null)}>
                    {t("Annuler")}
                  </button>
                </>
              ) : (
                <>
                  {(lieuxWix.length > 0 || emp.wix_lieu_nom) && (
                    <button className="admin-icon-btn" onClick={() => { setLienMsg(null); setLienModal({ emp }); }}>
                      {emp.wix_lieu_nom ? <>{t("Succursale Wix")}{" "}<IconCrochet className="gozly-icon" /></> : t("Succursale Wix")}
                    </button>
                  )}
                  <button className="admin-icon-btn" onClick={() => ouvrirHoraires(emp)}>
                    {emp.horaires_ouverture ? <>{t("Horaires")}{" "}<IconCrochet className="gozly-icon" /></> : t("Horaires")}
                  </button>
                  <button className="admin-icon-btn" onClick={() => startEdit(emp)}>
                    {t("Modifier")}
                  </button>
                  <button className="admin-icon-btn danger" onClick={() => handleDelete(emp.id)}>
                    {t("Retirer")}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {emplacements.length === 0 && <div className="admin-empty">{t("Un seul emplacement implicite pour l'instant.")}</div>}
      </div>

      {lienModal && (
        <div className="modal-overlay" onClick={() => setLienModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("Succursale Wix —")}{" "}{lienModal.emp.nom}</h3>
              <button className="admin-icon-btn" onClick={() => setLienModal(null)}>
                {t("Fermer")}
              </button>
            </div>
            <p className="section-hint">
              {t("Choisis la succursale Wix dont cet emplacement reçoit les commandes. Quand tous tes emplacements sont liés, chaque commande va à l'emplacement lié à son lieu, et un dashboard qui n'a qu'un emplacement lié ne reçoit que les commandes de ce lieu. Les lieux viennent des commandes déjà reçues.")}
            </p>
            {lienMsg && <p className={`settings-msg ${lienMsg.type}`}>{lienMsg.text}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[{ id: "", nom: t("Aucun lien (reconnaissance par le nom)") }, ...[...new Set([...lieuxWix, ...(lienModal.emp.wix_lieu_nom ? [lienModal.emp.wix_lieu_nom] : [])])].map((n) => ({ id: n, nom: n }))].map((o) => (
                <button
                  key={o.id || "aucun"}
                  type="button"
                  className="admin-icon-btn"
                  disabled={lienSaving}
                  style={(lienModal.emp.wix_lieu_nom || "") === o.id ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)", textAlign: "left" } : { textAlign: "left" }}
                  onClick={() => lierLieu(lienModal.emp, o.id)}
                >
                  {o.nom}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {horairesModal && (
        <div className="modal-overlay" onClick={() => setHorairesModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("Horaires d'ouverture —")}{" "}{horairesModal.emp.nom}</h3>
              <button className="admin-icon-btn" onClick={() => setHorairesModal(null)}>
                {t("Fermer")}
              </button>
            </div>
            <p className="section-hint">
              {t("Si un employé oublie de pointer son départ, il est pointé automatiquement 1 h 30 après la fermeture (avec l'heure de fermeture comme départ) et la feuille de temps affiche « oubli potentiel ». Laisse tous les jours fermés pour désactiver.")}
            </p>
            <form onSubmit={enregistrerHoraires}>
              {JOURS_OUVERTURE.map((j) => {
                const h = horairesModal.draft[j.id];
                const maj = (champ, valeur) =>
                  setHorairesModal((m) => ({ ...m, draft: { ...m.draft, [j.id]: { ...m.draft[j.id], [champ]: valeur } } }));
                return (
                  <div key={j.id} style={{ display: "grid", gridTemplateColumns: "110px 90px 1fr 1fr", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                    <span>{t(j.label)}</span>
                    <label style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "13px" }}>
                      <input type="checkbox" checked={h.ouvert} onChange={(e) => maj("ouvert", e.target.checked)} />{" "}{t("Ouvert")}
                    </label>
                    <input type="time" value={h.debut} onChange={(e) => maj("debut", e.target.value)} disabled={!h.ouvert} />
                    <input type="time" value={h.fin} onChange={(e) => maj("fin", e.target.value)} disabled={!h.ouvert} />
                  </div>
                );
              })}
              <div className="admin-edit-actions">
                <button type="submit" className="submit-btn" disabled={horairesSaving}>
                  {horairesSaving ? t("Enregistrement...") : t("Enregistrer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <form className="admin-add-form" onSubmit={handleAdd}>
        <input type="text" placeholder={t("Nom de la succursale")} value={nom} onChange={(e) => setNom(e.target.value)} required />
        <input
          type="text"
          placeholder={t("Adresse (optionnel)")}
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
        />
        <button type="submit" className="btn-small" disabled={geocodage}>
          {geocodage ? t("Localisation...") : t("Ajouter")}
        </button>
      </form>
    </div>
  );
}
