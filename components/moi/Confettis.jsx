"use client";

import { useMemo } from "react";

const COULEURS = ["#a07bff", "#7a3fe0", "#ffd479", "#5be3a1", "#ff7a90", "#ffffff", "#6ec1ff"];

// Confettis tirés du centre de l'écran (fin de journée : sortie pointée). Purement visuel, s'efface seul après ~3 s.
export default function Confettis({ nb = 70 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: nb }, (_, i) => {
        const angle = (Math.random() * 150 - 165) * (Math.PI / 180); // éventail vers le haut
        const force = 120 + Math.random() * 190;
        return {
          i,
          bx: Math.round(Math.cos(angle) * force),
          by: Math.round(Math.sin(angle) * force),
          fx: Math.round(Math.cos(angle) * force * 1.5 + (Math.random() * 80 - 40)),
          r: Math.round(Math.random() * 900 - 450),
          d: (2.2 + Math.random() * 1.1).toFixed(2),
          dl: (Math.random() * 0.18).toFixed(2),
          w: 6 + Math.round(Math.random() * 6),
          h: 8 + Math.round(Math.random() * 8),
          c: COULEURS[i % COULEURS.length],
        };
      }),
    [nb]
  );

  return (
    <div className="moi-confettis" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.i}
          style={{
            width: p.w,
            height: p.h,
            background: p.c,
            "--bx": `${p.bx}px`,
            "--by": `${p.by}px`,
            "--fx": `${p.fx}px`,
            "--r": `${p.r}deg`,
            "--d": `${p.d}s`,
            "--dl": `${p.dl}s`,
          }}
        />
      ))}
    </div>
  );
}
