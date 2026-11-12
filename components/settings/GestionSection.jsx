"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import DiscordCompteSection from "@/components/settings/DiscordCompteSection";
import SecuriteGestion from "@/components/gestion/SecuriteGestion";

export default function GestionSection({ user, profil, setProfil, router }) {
  const { t } = useT();
  const [desactive, setDesactive] = useState(profil?.desactive || false);
  const [toggling, setToggling] = useState(false);
  const [toggleMsg, setToggleMsg] = useState(null);

  const [deleteStatus, setDeleteStatus] = useState("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [mesApps, setMesApps] = useState([]);
  const [choixApps, setChoixApps] = useState(""); // "retirer" | "laisser"
  const [accord, setAccord] = useState(false);

  async function handleToggleDesactive() {
    if (!profil) return;
    const next = !desactive;
    setToggling(true);
    setToggleMsg(null);

    const { error } = await supabase.from("profils").update({ desactive: next }).eq("id", profil.id);

    setToggling(false);

    if (error) {
      setToggleMsg({ type: "err", text: t("L'opération a échoué. Réessaie dans un instant.") });
      return;
    }

    setDesactive(next);
    if (next) {
      setToggleMsg({ type: "ok", text: t("Compte désactivé. Déconnexion...") });
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push("/login?desactive=1");
      }, 1500);
    } else {
      setToggleMsg({ type: "ok", text: t("Compte réactivé !") });
      setTimeout(() => setToggleMsg(null), 3000);
    }
  }

  async function appelerApps(action, id) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/developpeur/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action, id }),
    });
    return res.ok;
  }

  async function handleDeleteRequest() {
    if (!confirmingDelete) {
      // Un développeur qui a des apps choisit d'abord ce qu'elles deviennent.
      const { data } = await supabase.from("apps_developpeur").select("id, nom").eq("proprietaire_id", user.id);
      setMesApps(data || []);
      setConfirmingDelete(true);
      return;
    }

    if (mesApps.length > 0) {
      if (choixApps === "laisser" ? !accord : choixApps !== "retirer") return;
      const ok = choixApps === "retirer" ? (await Promise.all(mesApps.map((a) => appelerApps("retirer", a.id)))).every(Boolean) : await appelerApps("laisser");
      if (!ok) {
        setDeleteStatus("error");
        return;
      }
    }

    setDeleteStatus("sending");

    const { error } = await supabase.from("messages_contact").insert({
      nom: profil?.full_name || user?.email,
      courriel: user?.email,
      objet: "Demande de suppression de compte",
      message: `L'utilisateur ${user?.email} (id: ${user?.id}) demande la suppression définitive de son compte et de ses données.${
        mesApps.length > 0 ? ` Apps développeur : ${choixApps === "retirer" ? "retirées" : "laissées (accord donné)"} (${mesApps.map((a) => a.nom).join(", ")}).` : ""
      }`,
    });

    if (error) {
      setDeleteStatus("error");
      return;
    }

    setDeleteStatus("sent");
  }

  return (
    <div>
      <h2>{t("Gestion du compte")}</h2>

      <div className="settings-section">
        <h3>{t("Désactiver mon compte")}</h3>
        <p className="section-hint">
          {t("Un compte désactivé ne peut plus se connecter. Tu peux le réactiver ici à tout moment (en te reconnectant en cas de doute, contacte-nous).")}
        </p>
        <div className="switch-row">
          <div className="switch-row-text">
            <h4>{desactive ? t("Compte actuellement désactivé") : t("Compte actif")}</h4>
            <p>{desactive ? t("Personne ne peut se connecter à ce compte.") : t("Le compte fonctionne normalement.")}</p>
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

      <div className="settings-section">
        <h3>{t("Double authentification")}</h3>
        <SecuriteGestion sansTitre />
      </div>

      <DiscordCompteSection profil={profil} setProfil={setProfil} />

      <div className="settings-divider">{t("Zone dangereuse")}</div>

      <div className="settings-section">
        <div className="danger-zone">
          <div>
            <h4>{t("Supprimer mon compte")}</h4>
            <p>
              {deleteStatus === "sent"
                ? t("Ta demande a été envoyée. On te contacte à {email} pour confirmer la suppression.", { email: user?.email })
                : confirmingDelete
                ? t("Confirme : on va t'envoyer les prochaines étapes par courriel.")
                : t("Envoie une demande de suppression définitive de ton compte et de tes données.")}
            </p>
          </div>
          {confirmingDelete && mesApps.length > 0 && deleteStatus !== "sent" && (
            <div style={{ flexBasis: "100%", display: "grid", gap: "8px" }}>
              <strong>{t("Tu as {n} app(s) : {noms}", { n: mesApps.length, noms: mesApps.map((a) => a.nom).join(", ") })}</strong>
              <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="radio" name="choix-apps" checked={choixApps === "retirer"} onChange={() => setChoixApps("retirer")} />
                {t("Les retirer (les entreprises qui les ont installées les perdront)")}
              </label>
              <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="radio" name="choix-apps" checked={choixApps === "laisser"} onChange={() => setChoixApps("laisser")} />
                {t("Les laisser en ligne")}
              </label>
              {choixApps === "laisser" && (
                <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "13.5px" }}>
                  <input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} style={{ marginTop: "3px" }} />
                  {t("Je confirme que le service de mes apps restera en ligne, ou qu'elles peuvent fonctionner sans mise à jour de ma part. Je comprends que Gozly peut les retirer si elles cessent de fonctionner.")}
                </label>
              )}
            </div>
          )}
          <button
            className="btn-danger"
            onClick={handleDeleteRequest}
            disabled={
              deleteStatus === "sending" ||
              deleteStatus === "sent" ||
              (confirmingDelete && mesApps.length > 0 && (choixApps === "" || (choixApps === "laisser" && !accord)))
            }
          >
            {deleteStatus === "sent"
              ? t("Demande envoyée")
              : deleteStatus === "sending"
              ? t("Envoi...")
              : confirmingDelete
              ? t("Confirmer la demande")
              : t("Supprimer mon compte")}
          </button>
        </div>
      </div>
    </div>
  );
}
