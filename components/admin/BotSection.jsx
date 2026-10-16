"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

async function jeton(ref) {
  // getSession peut rester bloqué (verrou d'auth) : on retombe sur le dernier jeton connu.
  const token = await Promise.race([
    supabase.auth.getSession().then(({ data: { session } }) => session?.access_token || null),
    new Promise((resolve) => setTimeout(() => resolve(ref.current), 3000)),
  ]);
  if (token) ref.current = token;
  return token;
}

// Réglages du bot Gozlyx : envoyer la liste des commandes à Discord (à faire après l'ajout d'une commande).
export default function BotSection() {
  const tokenRef = useRef(null);
  const [cmd, setCmd] = useState({ occupe: false, message: "", ok: false });

  async function majCommandes() {
    setCmd({ occupe: true, message: "", ok: false });
    const token = await jeton(tokenRef);
    try {
      const res = await fetch("/api/admin/discord-commandes", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setCmd({ occupe: false, ok: true, message: `${json.commandes.length} commandes enregistrées : ${json.commandes.map((c) => "/" + c).join(", ")}` });
    } catch (e) {
      setCmd({ occupe: false, ok: false, message: `Erreur : ${e.message}` });
    }
  }

  return (
    <div>
      <h2>Bot Gozlyx</h2>
      <p className="panel-hint">
        Quand une commande est ajoutée ou modifiée dans le bot, clique ici pour l'envoyer à Discord. Les nouvelles commandes apparaissent ensuite dans le serveur (recharge Discord avec Ctrl+R si besoin).
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
        <button type="button" className="btn-small" onClick={majCommandes} disabled={cmd.occupe}>
          {cmd.occupe ? "Mise à jour..." : "Mettre à jour les commandes du bot"}
        </button>
      </div>
      {cmd.message && <p className={`settings-msg ${cmd.ok ? "ok" : "err"}`}>{cmd.message}</p>}
    </div>
  );
}
