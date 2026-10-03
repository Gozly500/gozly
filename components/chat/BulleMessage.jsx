"use client";

import { useRef, useState } from "react";
import { EMOJIS_REACTION_CLIENT } from "@/components/chat/emojisChat";

const SEUIL_REPONSE = 56; // px de glissement vers la droite pour déclencher "Répondre"
const GLISSEMENT_MAX = 84;

// Résultat d'un clic sur un emoji : ma réaction est retirée (même emoji), remplacée (autre emoji) ou ajoutée.
export function appliquerReactionLocale(reactions, emoji, nom = "") {
  const autres = (reactions || []).filter((r) => !r.mine);
  const monAncienne = (reactions || []).find((r) => r.mine);
  if (monAncienne?.emoji === emoji) return autres;
  return [...autres, { emoji, nom, mine: true }];
}

// Une bulle de message : citation du message auquel on répond, texte, réactions groupées,
// et (en appuyant sur la bulle) la barre d'actions : emojis + Répondre.
// Glisser la bulle vers la droite = répondre à ce message.
// m : { id, auteur, mine, contenu, reponse: { auteur, contenu } | null, reactions: [{ emoji, nom, mine }], tmp }
export default function BulleMessage({ m, ouvert, onToggle, onReagir, onRepondre, texteRepondre = "Répondre" }) {
  const [dx, setDx] = useState(0);
  const [retour, setRetour] = useState(false); // animation de retour en place après le relâchement
  const depart = useRef(null);
  const dxRef = useRef(0);
  const aGlisse = useRef(false);

  function fixerDx(v) {
    dxRef.current = v;
    setDx(v);
  }

  function auDebut(e) {
    if (m.tmp || e.target.closest("button")) return;
    depart.current = { x: e.clientX, y: e.clientY, verrou: false, passe: false };
    aGlisse.current = false;
    setRetour(false);
  }

  function enMouvement(e) {
    const d = depart.current;
    if (!d) return;
    const ddx = e.clientX - d.x;
    const ddy = e.clientY - d.y;
    if (!d.verrou) {
      // Geste surtout vertical : c'est un défilement, on laisse faire.
      if (Math.abs(ddy) > 10 && Math.abs(ddy) > Math.abs(ddx)) {
        depart.current = null;
        return;
      }
      if (ddx > 8) {
        d.verrou = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      } else {
        return;
      }
    }
    aGlisse.current = true;
    const v = ddx > 0 ? Math.min(ddx * 0.7, GLISSEMENT_MAX) : 0;
    fixerDx(v);
    if (v >= SEUIL_REPONSE && !d.passe) {
      d.passe = true;
      try {
        navigator.vibrate?.(8);
      } catch {}
    } else if (v < SEUIL_REPONSE) {
      d.passe = false;
    }
  }

  function aLaFin() {
    const d = depart.current;
    depart.current = null;
    const declenche = d?.verrou && dxRef.current >= SEUIL_REPONSE;
    setRetour(true);
    fixerDx(0);
    if (declenche) onRepondre();
  }

  const groupes = [];
  for (const r of m.reactions || []) {
    let g = groupes.find((x) => x.emoji === r.emoji);
    if (!g) {
      g = { emoji: r.emoji, noms: [], mine: false };
      groupes.push(g);
    }
    g.noms.push(r.mine ? "✓" : r.nom);
    if (r.mine) g.mine = true;
  }

  const progres = Math.min(dx / SEUIL_REPONSE, 1);

  return (
    <div
      className={`chat-bubble-row chat-swipe${m.mine ? " mine" : ""}`}
      style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: retour ? "transform .2s ease-out" : "none" }}
      onPointerDown={auDebut}
      onPointerMove={enMouvement}
      onPointerUp={aLaFin}
      onPointerCancel={aLaFin}
    >
      <span className="chat-swipe-icone" style={{ opacity: progres, transform: `translateY(-50%) scale(${0.6 + 0.4 * progres})` }}>
        ↩
      </span>
      <div className="chat-bubble-auteur">{m.auteur}</div>
      <div
        className="chat-bubble chat-bubble-cliquable"
        onClick={() => {
          if (aGlisse.current) {
            aGlisse.current = false;
            return;
          }
          if (!m.tmp) onToggle();
        }}
      >
        {m.reponse && (
          <div className="chat-citation">
            <strong>{m.reponse.auteur}</strong>
            <span>{m.reponse.contenu}</span>
          </div>
        )}
        {m.contenu}
      </div>
      {groupes.length > 0 && (
        <div className="chat-reactions">
          {groupes.map((g) => (
            <button
              key={g.emoji}
              type="button"
              className={`chat-reaction-chip${g.mine ? " mine" : ""}`}
              title={g.noms.join(", ")}
              onClick={() => onReagir(g.emoji)}
            >
              {g.emoji} {g.noms.length}
            </button>
          ))}
        </div>
      )}
      {ouvert && (
        <div className="chat-actions">
          {EMOJIS_REACTION_CLIENT.map((e) => (
            <button key={e} type="button" className="chat-action-emoji" onClick={() => onReagir(e)}>
              {e}
            </button>
          ))}
          <button type="button" className="chat-action-repondre" onClick={onRepondre}>
            ↩ {texteRepondre}
          </button>
        </div>
      )}
    </div>
  );
}
