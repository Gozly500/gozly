"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function GestionSection({ user, profil, router }) {
  const [desactive, setDesactive] = useState(profil?.desactive || false);
  const [toggling, setToggling] = useState(false);
  const [toggleMsg, setToggleMsg] = useState(null);

  const [deleteStatus, setDeleteStatus] = useState("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleToggleDesactive() {
    if (!profil) return;
    const next = !desactive;
    setToggling(true);
    setToggleMsg(null);

    const { error } = await supabase.from("profils").update({ desactive: next }).eq("id", profil.id);

    setToggling(false);

    if (error) {
      setToggleMsg({ type: "err", text: "L'opération a échoué. Réessaie dans un instant." });
      return;
    }

    setDesactive(next);
    if (next) {
      setToggleMsg({ type: "ok", text: "Compte désactivé. Déconnexion..." });
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push("/login?desactive=1");
      }, 1500);
    } else {
      setToggleMsg({ type: "ok", text: "Compte réactivé !" });
      setTimeout(() => setToggleMsg(null), 3000);
    }
  }

  async function handleDeleteRequest() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    setDeleteStatus("sending");

    const { error } = await supabase.from("messages_contact").insert({
      nom: profil?.full_name || user?.email,
      courriel: user?.email,
      objet: "Demande de suppression de compte",
      message: `L'utilisateur ${user?.email} (id: ${user?.id}) demande la suppression définitive de son compte et de ses données.`,
    });

    if (error) {
      setDeleteStatus("error");
      return;
    }

    setDeleteStatus("sent");
  }

  return (
    <div>
      <h2>Gestion du compte</h2>
      <p className="panel-hint">Désactive ou supprime ton compte Gozly.</p>

      <div className="settings-section">
        <h3>Désactiver mon compte</h3>
        <p className="section-hint">
          Un compte désactivé ne peut plus se connecter. Tu peux le réactiver ici à tout moment
          (en te reconnectant en cas de doute, contacte-nous).
        </p>
        <div className="switch-row">
          <div className="switch-row-text">
            <h4>{desactive ? "Compte actuellement désactivé" : "Compte actif"}</h4>
            <p>{desactive ? "Personne ne peut se connecter à ce compte." : "Le compte fonctionne normalement."}</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={desactive}
              onChange={handleToggleDesactive}
              disabled={toggling || !profil}
            />
            <span className="switch-track"></span>
            <span className="switch-thumb"></span>
          </label>
        </div>
        {toggleMsg && <p className={`settings-msg ${toggleMsg.type}`}>{toggleMsg.text}</p>}
      </div>

      <div className="settings-divider">Zone dangereuse</div>

      <div className="settings-section">
        <div className="danger-zone">
          <div>
            <h4>Supprimer mon compte</h4>
            <p>
              {deleteStatus === "sent"
                ? "Ta demande a été envoyée. On te contacte à " + user?.email + " pour confirmer la suppression."
                : confirmingDelete
                ? "Confirme : on va t'envoyer les prochaines étapes par courriel."
                : "Envoie une demande de suppression définitive de ton compte et de tes données."}
            </p>
          </div>
          <button
            className="btn-danger"
            onClick={handleDeleteRequest}
            disabled={deleteStatus === "sending" || deleteStatus === "sent"}
          >
            {deleteStatus === "sent"
              ? "Demande envoyée"
              : deleteStatus === "sending"
              ? "Envoi..."
              : confirmingDelete
              ? "Confirmer la demande"
              : "Supprimer mon compte"}
          </button>
        </div>
      </div>
    </div>
  );
}
