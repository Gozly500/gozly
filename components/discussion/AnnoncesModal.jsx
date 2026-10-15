"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SimpleSelect from "@/components/SimpleSelect";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";

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
  const { t } = useT();
  const [contenu, setContenu] = useState("");
  const [duree, setDuree] = useState("168");
  const [encours, setEncours] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [lectures, setLectures] = useState({}); // { annonceId: Set d'employés qui ont touché « OK » }
  const [detailOuvert, setDetailOuvert] = useState(null);
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
    const { data } = await supabase
      .from("annonces")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gt("fin", maintenant)
      .order("debut", { ascending: false });
    const liste = data || [];
    setEncours(liste);

    // Accusés de lecture (supabase/annonces_lectures.sql) : table absente = on n'affiche simplement pas « lu par ».
    if (liste.length > 0) {
      const { data: lus, error } = await supabase.from("annonce_lectures").select("annonce_id, employe_id").in("annonce_id", liste.map((a) => a.id));
      if (!error) {
        const parAnnonce = {};
        for (const l of lus || []) (parAnnonce[l.annonce_id] ||= new Set()).add(l.employe_id);
        setLectures(parAnnonce);
      }
    }
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
        setMsg({ type: "err", text: data.error || t("La publication a échoué.") });
      } else {
        setContenu("");
        setMsg({ type: "ok", text: t("Annonce publiée. Les employés ont reçu une notification.") });
        charger();
      }
    } catch {
      setMsg({ type: "err", text: t("La publication a échoué.") });
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
          <h3>{t("Annonce")}</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            {t("Fermer")}
          </button>
        </div>

        <p className="panel-hint">{t("Un message mis en évidence en haut de l'app de tous tes employés, pendant la durée que tu choisis.")}</p>

        <form onSubmit={publier}>
          <div className="field">
            <label>{t("Annonce")}</label>
            <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={4} maxLength={600} placeholder={t("Ex: La caisse sera fermée samedi matin pour l'inventaire.")} />
          </div>
          <div className="field">
            <label>{t("Affichée pendant")}</label>
            <SimpleSelect options={DUREES} value={duree} onChange={setDuree} />
          </div>
          {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
          <button type="submit" className="submit-btn" disabled={busy || !contenu.trim()}>
            {busy ? t("Publication...") : t("Publier l'annonce")}
          </button>
        </form>

        {encours.length > 0 && (
          <div style={{ marginTop: "22px" }}>
            <h4 style={{ fontSize: "14.5px", fontWeight: 600 }}>{t("En cours")}</h4>
            <div className="admin-list">
              {encours.map((a) => (
                <div className="admin-row" key={a.id}>
                  <div className="admin-row-main">
                    <div className="admin-row-title" style={{ whiteSpace: "normal" }}>{a.contenu}</div>
                    <div className="admin-row-sub">{t("Jusqu'au")}{" "}{new Date(a.fin).toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short" })}</div>
                    {employes.length > 0 && (
                      <div className="admin-row-sub" style={{ marginTop: "4px" }}>
                        <button type="button" className="admin-icon-btn" onClick={() => setDetailOuvert((v) => (v === a.id ? null : a.id))}>
                          {t("Lu par")}{" "}{(lectures[a.id] || new Set()).size}{" "}{t("sur")}{" "}{employes.length}
                        </button>
                        {detailOuvert === a.id && (
                          <div style={{ marginTop: "8px" }}>
                            <div>
                              <strong>{t("Pas encore lu :")}</strong>{" "}
                              {employes.filter((e) => !(lectures[a.id] || new Set()).has(e.id)).map((e) => e.nom).join(", ") || t("Tout le monde l'a lue")}
                            </div>
                            <div style={{ marginTop: "4px" }}>
                              <strong>{t("Lu :")}</strong> {employes.filter((e) => (lectures[a.id] || new Set()).has(e.id)).map((e) => e.nom).join(", ") || t("Personne")}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="admin-row-controls">
                    <button className="admin-icon-btn danger" onClick={() => retirer(a.id)}>
                      {t("Retirer")}
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
