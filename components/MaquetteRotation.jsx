"use client";

import { Children, useEffect, useRef, useState } from "react";

// Cadre de la maquette du hero : fait défiler les vues (une par module) toutes les 8 secondes
// avec un fondu. Pause quand la souris est dessus ; aucune rotation si la personne a demandé
// moins d'animations. Les vues elles-mêmes sont rendues côté serveur (HeroMaquette).
export default function MaquetteRotation({ urls, children }) {
  const vues = Children.toArray(children);
  const [i, setI] = useState(0);
  const pause = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (!pause.current && !document.hidden) setI((v) => (v + 1) % vues.length);
    }, 8000);
    return () => clearInterval(id);
  }, [vues.length]);

  return (
    <div className="mq" onMouseEnter={() => (pause.current = true)} onMouseLeave={() => (pause.current = false)}>
      <div className="mq-barre">
        <i /><i /><i />
        <span className="mq-url">{urls[i]}</span>
        <span className="mq-points">
          {vues.map((_, k) => (
            <b key={k} className={k === i ? "on" : ""} />
          ))}
        </span>
      </div>
      <div className="mq-vues">
        {vues.map((v, k) => (
          <div key={k} className={`mq-vue${k === i ? " actif" : ""}`}>
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}
