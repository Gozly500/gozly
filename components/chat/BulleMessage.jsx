"use client";

import { EMOJIS_REACTION_CLIENT } from "@/components/chat/emojisChat";

// Résultat d'un clic sur un emoji : ma réaction est retirée (même emoji), remplacée (autre emoji) ou ajoutée.
export function appliquerReactionLocale(reactions, emoji, nom = "") {
  const autres = (reactions || []).filter((r) => !r.mine);
  const monAncienne = (reactions || []).find((r) => r.mine);
  if (monAncienne?.emoji === emoji) return autres;
  return [...autres, { emoji, nom, mine: true }];
}

// Une bulle de message : citation du message auquel on répond, texte, réactions groupées,
// et (en appuyant sur la bulle) la barre d'actions : emojis + Répondre.
// m : { id, auteur, mine, contenu, reponse: { auteur, contenu } | null, reactions: [{ emoji, nom, mine }], tmp }
export default function BulleMessage({ m, ouvert, onToggle, onReagir, onRepondre, texteRepondre = "Répondre" }) {
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

  return (
    <div className={`chat-bubble-row${m.mine ? " mine" : ""}`}>
      <div className="chat-bubble-auteur">{m.auteur}</div>
      <div className="chat-bubble chat-bubble-cliquable" onClick={() => !m.tmp && onToggle()}>
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
