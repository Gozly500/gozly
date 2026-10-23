"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SimpleSelect from "@/components/SimpleSelect";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";

// <input type="datetime-local"> veut "AAAA-MM-JJTHH:MM" en heure locale.
function versDatetimeLocal(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// « Pointer pour un employé » : le gestionnaire ajoute un pointage à la place de quelqu'un (oubli, employé sans
// téléphone...). Le pointage est marqué source = "gestionnaire" pour que ce soit visible dans la feuille de temps.
// Réservé à ceux qui peuvent corriger la feuille de temps : l'appelant n'affiche le bouton que pour eux.
export default function PointerPourEmployeModal({ entrepriseId, employes, emplacements = [], emplacementId = null, onClose, onSaved }) {
  const { t: tr } = useT();
  const [employeId, setEmployeId] = useState("");
  const [entree, setEntree] = useState(() => versDatetimeLocal(new Date()));
  const [sortie, setSortie] = useState("");
  const [empl, setEmpl] = useState(() => emplacementId || emplacements[0]?.id || null);
  const [ouvert, setOuvert] = useState(null); // pointage encore ouvert de l'employé choisi : { id, entree }
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState(null);

  const employe = employes.find((e) => e.id === employeId);

  // Quand on choisit un employé : est-il déjà au travail (pointage sans départ) ?
  useEffect(() => {
    setOuvert(null);
    if (!employeId) return;
    let ignore = false;
    supabase
      .from("pointages")
      .select("id, entree")
      .eq("employe_id", employeId)
      .is("sortie", null)
      .order("entree", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => !ignore && setOuvert(data || null));
    return () => {
      ignore = true;
    };
  }, [employeId]);

  async function terminerMaintenant() {
    setBusy(true);
    setErreur(null);
    const { error } = await supabase.from("pointages").update({ sortie: new Date().toISOString(), sortie_auto: false }).eq("id", ouvert.id);
    setBusy(false);
    if (error) return setErreur(tr("L'enregistrement a échoué."));
    onSaved();
  }

  async function enregistrer(e) {
    e.preventDefault();
    setErreur(null);
    if (!employeId) return setErreur(tr("Choisis un employé."));

    const debut = new Date(entree);
    const fin = sortie ? new Date(sortie) : null;
    if (Number.isNaN(debut.getTime())) return setErreur(tr("Entre l'heure d'arrivée."));
    if (debut.getTime() > Date.now() + 5 * 60000) return setErreur(tr("L'arrivée ne peut pas être dans le futur."));
    if (fin && fin <= debut) return setErreur(tr("Le départ doit être après l'arrivée."));
    if (fin && fin.getTime() > Date.now() + 5 * 60000) return setErreur(tr("Le départ ne peut pas être dans le futur."));
    if (!fin && ouvert) return setErreur(tr("Cet employé est déjà au travail. Pointe d'abord son départ."));

    setBusy(true);
    // Pas de chevauchement avec un pointage existant du même employé.
    const { data: chevauche } = await supabase
      .from("pointages")
      .select("id")
      .eq("employe_id", employeId)
      .lt("entree", (fin || new Date("9999-12-31")).toISOString())
      .or(`sortie.is.null,sortie.gt.${debut.toISOString()}`)
      .limit(1);
    if (chevauche && chevauche.length > 0) {
      setBusy(false);
      return setErreur(tr("Ces heures chevauchent un pointage existant de cet employé."));
    }

    const ligne = {
      entreprise_id: entrepriseId,
      employe_id: employeId,
      entree: debut.toISOString(),
      sortie: fin ? fin.toISOString() : null,
      emplacement_id: empl,
    };
    let { error } = await supabase.from("pointages").insert({ ...ligne, source: "gestionnaire" });
    // La colonne « source » vient de supabase/pointage_mobile.sql : si elle n'existe pas encore, on enregistre quand même.
    if (error && /source/i.test(error.message || "")) ({ error } = await supabase.from("pointages").insert(ligne));
    setBusy(false);
    if (error) return setErreur(tr("L'enregistrement a échoué."));
    onSaved();
  }

  const heureOuvert = ouvert ? new Date(ouvert.entree).toLocaleString(loc(), { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: "400px", overflow: "visible" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{tr("Pointer pour un employé")}</h3>
          <button type="button" className="admin-icon-btn" onClick={onClose}>
            {tr("Fermer")}
          </button>
        </div>
        <p className="section-hint" style={{ marginBottom: "14px" }}>
          {tr("Ajoute un pointage à la place d'un employé (oubli, pas de téléphone...). Il sera marqué « ajouté par un gestionnaire ».")}
        </p>

        <form onSubmit={enregistrer}>
          <div className="field">
            <label>{tr("Employé")}</label>
            <SimpleSelect
              options={employes.map((x) => ({ id: x.id, label: x.nom }))}
              value={employeId}
              onChange={setEmployeId}
              placeholder={tr("Choisir un employé")}
            />
          </div>

          {ouvert && (
            <div className="settings-section" style={{ margin: "0 0 14px" }}>
              <p style={{ margin: "0 0 10px" }}>
                {tr("{nom} est au travail depuis {heure}.", { nom: employe?.nom || "", heure: heureOuvert })}
              </p>
              <button type="button" className="submit-btn" style={{ width: "100%" }} disabled={busy} onClick={terminerMaintenant}>
                {tr("Pointer son départ maintenant")}
              </button>
            </div>
          )}

          {emplacements.length > 1 && (
            <div className="field">
              <label>{tr("Succursale")}</label>
              <SimpleSelect options={emplacements.map((x) => ({ id: x.id, label: x.nom }))} value={empl} onChange={setEmpl} />
            </div>
          )}

          <div className="field">
            <label>{tr("Arrivée")}</label>
            <input type="datetime-local" value={entree} onChange={(e) => setEntree(e.target.value)} required />
          </div>
          <div className="field">
            <label>{tr("Départ (laisser vide si toujours en cours)")}</label>
            <input type="datetime-local" value={sortie} onChange={(e) => setSortie(e.target.value)} />
          </div>

          {erreur && <p className="settings-msg err">{erreur}</p>}

          <div className="admin-edit-actions">
            <button type="submit" className="submit-btn" disabled={busy}>
              {busy ? tr("Enregistrement...") : tr("Ajouter le pointage")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
