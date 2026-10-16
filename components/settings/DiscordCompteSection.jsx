"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";

// Compte Discord lié au compte Gozly (voir /discord/lier). On y voit l'état et on peut délier.
// La liaison se fait depuis le salon « sidentifier » du Discord de Gozly.
export default function DiscordCompteSection({ profil, setProfil }) {
  const { t } = useT();
  const tokenRef = useRef(null);
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState(null);
  const lie = !!profil?.discord_id;

  async function delier() {
    if (!window.confirm(t("Délier ton compte Discord ? Le rôle « Compte lié » te sera retiré sur le serveur."))) return;
    setOccupe(true);
    setMsg(null);
    try {
      const token = await Promise.race([
        supabase.auth.getSession().then(({ data: { session } }) => session?.access_token || null),
        new Promise((resolve) => setTimeout(() => resolve(tokenRef.current), 3000)),
      ]);
      const res = await fetch("/api/discord/lier", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "delier" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setProfil({ ...profil, discord_id: null });
      setMsg({ type: "ok", text: t("Ton compte Discord a été délié.") });
    } catch (e) {
      setMsg({ type: "err", text: `${t("Quelque chose n'a pas fonctionné")} : ${e.message}` });
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="settings-section">
      <h3>Discord</h3>
      {lie ? (
        <>
          <p className="section-hint">{t("Ton compte Gozly est lié à Discord. Tu as le rôle « Compte lié » sur le serveur.")}</p>
          <button type="button" className="btn-small" onClick={delier} disabled={occupe}>
            {occupe ? t("En cours...") : t("Délier mon compte Discord")}
          </button>
        </>
      ) : (
        <p className="section-hint">
          {t("Ton compte n'est pas lié à Discord. Pour le lier, va dans le salon « sidentifier » du Discord de Gozly et clique sur « Lier mon compte Gozly ».")}
        </p>
      )}
      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
    </div>
  );
}
