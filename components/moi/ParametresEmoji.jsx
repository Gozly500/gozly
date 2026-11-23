"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import MoiRetour from "@/components/moi/MoiRetour";
import { useLangue } from "@/components/moi/LangueContext";
import { employeFetch } from "@/lib/employeAuth";
import { EMOJIS_PROFIL } from "@/lib/emojisProfil";

// Page « Photo de profil » de l'app employé : on choisit un émoji (enregistré tout de suite) ou on le retire.
export default function ParametresEmoji() {
  const { t } = useLangue();
  const [nom, setNom] = useState("");
  const [emoji, setEmoji] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: "ok" | "err", text }

  useEffect(() => {
    employeFetch("/api/employe-app/emoji")
      .then(async (res) => {
        const data = await res.json();
        setNom(data.nom || "");
        setEmoji(data.emoji || null);
      })
      .catch(() => {});
  }, []);

  async function choisir(valeur) {
    if (busy || valeur === emoji) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await employeFetch("/api/employe-app/emoji", { method: "POST", body: JSON.stringify({ emoji: valeur }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ type: "err", text: data.error || t("emoji.erreur") });
      else setEmoji(valeur);
    } catch {
      setMsg({ type: "err", text: t("emoji.erreur") });
    }
    setBusy(false);
  }

  return (
    <div>
      <MoiRetour />
      <h2>{t("parametres.emojiTitre")}</h2>
      <p className="panel-hint">{t("emoji.hint")}</p>
      <div className="emoji-apercu">
        <Avatar emoji={emoji} nom={nom} taille={96} />
        <strong>{nom}</strong>
      </div>
      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
      <div className="emoji-grille" role="group" aria-label={t("parametres.emojiTitre")}>
        {EMOJIS_PROFIL.map((e) => (
          <button key={e} type="button" className={`emoji-case${emoji === e ? " actif" : ""}`} onClick={() => choisir(e)} disabled={busy} aria-pressed={emoji === e}>
            {e}
          </button>
        ))}
      </div>
      {emoji && (
        <button type="button" className="btn-small" style={{ marginTop: "18px" }} disabled={busy} onClick={() => choisir(null)}>
          {t("emoji.retirer")}
        </button>
      )}
    </div>
  );
}
