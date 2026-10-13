"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Fenêtre « Discussion » d'un employé (Employés > bouton Discussion) : ce qu'il a le droit de faire dans la
// messagerie de l'app employé, et avec qui il ne peut PAS communiquer. Les changements s'enregistrent
// tout de suite. Voir supabase/chat_restrictions.sql.
export default function CommunicationEmploye({ emp, employes, entrepriseId, onClose, onChange }) {
  const [groupes, setGroupes] = useState(emp.chat_groupes_autorise !== false);
  const [multi, setMulti] = useState(emp.chat_multi_autorise !== false);
  const [blocages, setBlocages] = useState([]); // lignes de chat_blocages impliquant cet employé
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    chargerBlocages();
  }, [emp.id]);

  async function chargerBlocages() {
    const { data, error } = await supabase.from("chat_blocages").select("*").or(`employe_id.eq.${emp.id},bloque_id.eq.${emp.id}`);
    if (error) setMsg({ type: "err", text: "Les blocages ne sont pas disponibles : le fichier SQL chat_restrictions.sql est-il exécuté ?" });
    setBlocages(data || []);
    setLoading(false);
  }

  function estBloque(autreId) {
    return blocages.some((b) => (b.employe_id === emp.id && b.bloque_id === autreId) || (b.employe_id === autreId && b.bloque_id === emp.id));
  }

  async function changerDroit(colonne, valeur, setter) {
    setter(valeur);
    setMsg(null);
    const { error } = await supabase.from("employes").update({ [colonne]: valeur }).eq("id", emp.id);
    if (error) {
      setter(!valeur);
      setMsg({ type: "err", text: "L'enregistrement a échoué (le fichier SQL chat_restrictions.sql est-il exécuté ?)." });
      return;
    }
    onChange?.(emp.id, { [colonne]: valeur });
  }

  async function basculerBlocage(autreId) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    let erreur = null;
    if (estBloque(autreId)) {
      // Retire le blocage dans les deux sens.
      const retraits = await Promise.all([
        supabase.from("chat_blocages").delete().eq("employe_id", emp.id).eq("bloque_id", autreId),
        supabase.from("chat_blocages").delete().eq("employe_id", autreId).eq("bloque_id", emp.id),
      ]);
      erreur = retraits.find((r) => r.error)?.error || null;
    } else {
      const { error } = await supabase.from("chat_blocages").insert({ entreprise_id: entrepriseId, employe_id: emp.id, bloque_id: autreId });
      erreur = error;
    }
    if (erreur) setMsg({ type: "err", text: "L'enregistrement a échoué (le fichier SQL chat_restrictions.sql est-il exécuté ?)." });
    await chargerBlocages();
    setBusy(false);
  }

  const autres = employes.filter((e) => e.id !== emp.id);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Discussion · {emp.nom}</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            Fermer
          </button>
        </div>

        <p className="panel-hint">Ce que cet employé peut faire dans la messagerie de l'app. Les changements s'appliquent tout de suite.</p>

        <div className="switch-row" style={{ marginBottom: "12px" }}>
          <div className="switch-row-text">
            <h4>Créer des groupes</h4>
            <p>Peut créer des groupes de discussion avec ses collègues.</p>
          </div>
          <label className="switch">
            <input type="checkbox" checked={groupes} onChange={(e) => changerDroit("chat_groupes_autorise", e.target.checked, setGroupes)} />
            <span className="switch-track"></span>
            <span className="switch-thumb"></span>
          </label>
        </div>

        <div className="switch-row" style={{ marginBottom: "18px" }}>
          <div className="switch-row-text">
            <h4>Écrire à plusieurs personnes</h4>
            <p>Peut envoyer un même message à plusieurs collègues à la fois (chacun le reçoit séparément, sans groupe).</p>
          </div>
          <label className="switch">
            <input type="checkbox" checked={multi} onChange={(e) => changerDroit("chat_multi_autorise", e.target.checked, setMulti)} />
            <span className="switch-track"></span>
            <span className="switch-thumb"></span>
          </label>
        </div>

        <h4 style={{ fontSize: "14.5px", fontWeight: 600 }}>Communication coupée avec…</h4>
        <p className="panel-hint" style={{ margin: "2px 0 8px" }}>
          Coche les personnes avec qui {emp.nom} ne peut plus communiquer. C'est dans les deux sens : ni l'un ni l'autre ne peut écrire à l'autre en direct, et leur conversation existante est désactivée (les anciens messages restent visibles). Ils ne
          peuvent pas non plus être mis dans un même nouveau groupe. Les groupes qui existent déjà ne sont pas touchés.
        </p>

        {loading ? (
          <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
        ) : autres.length === 0 ? (
          <p className="chat-empty">Aucun autre employé.</p>
        ) : (
          <div className="moi-picker-list" style={{ maxHeight: "260px", overflowY: "auto" }}>
            {autres.map((a) => (
              <label className="moi-picker-row" key={a.id} style={{ cursor: "pointer" }}>
                <span>{a.nom}</span>
                <input type="checkbox" checked={estBloque(a.id)} disabled={busy} onChange={() => basculerBlocage(a.id)} />
              </label>
            ))}
          </div>
        )}

        {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
