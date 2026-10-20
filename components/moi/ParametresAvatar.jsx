"use client";

import { useEffect, useState } from "react";
import AvatarEditeur from "@/components/AvatarEditeur";
import MoiRetour from "@/components/moi/MoiRetour";
import BetaBadge from "@/components/BetaBadge";
import { useLangue } from "@/components/moi/LangueContext";
import { employeFetch } from "@/lib/employeAuth";
import { avatarParDefaut } from "@/lib/avatar";

// Page « Mon avatar » de l'app employé : on compose son robot, puis on l'enregistre.
export default function ParametresAvatar() {
  const { t, langue } = useLangue();
  const [nom, setNom] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [initial, setInitial] = useState(null); // pour savoir s'il y a eu un changement
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: "ok" | "err", text }

  useEffect(() => {
    employeFetch("/api/employe-app/avatar")
      .then(async (res) => {
        const data = await res.json();
        const depart = data.avatar || avatarParDefaut(data.nom);
        setNom(data.nom || "");
        setAvatar(depart);
        setInitial(JSON.stringify(depart));
      })
      .catch(() => {});
  }, []);

  async function enregistrer() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await employeFetch("/api/employe-app/avatar", { method: "POST", body: JSON.stringify({ avatar }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || t("avatar.erreur") });
      } else {
        setInitial(JSON.stringify(avatar));
        setMsg({ type: "ok", text: t("avatar.enregistre") });
      }
    } catch {
      setMsg({ type: "err", text: t("avatar.erreur") });
    }
    setBusy(false);
  }

  const modifie = avatar && JSON.stringify(avatar) !== initial;

  return (
    <div>
      <MoiRetour />
      <h2>
        {t("parametres.avatarTitre")}
        <BetaBadge hauteur={22} />
      </h2>
      <p className="panel-hint">{t("avatar.hint")}</p>
      {avatar && <AvatarEditeur valeur={avatar} onChange={setAvatar} nom={nom} langue={langue} />}
      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
      <button type="button" className="submit-btn" style={{ width: "100%", marginTop: "18px" }} disabled={busy || !modifie} onClick={enregistrer}>
        {busy ? t("avatar.enregistrement") : t("avatar.enregistrer")}
      </button>
    </div>
  );
}
