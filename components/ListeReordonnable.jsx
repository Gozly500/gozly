"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/LangProvider";

const MARGE_DEFILEMENT = 80; // px du bord de l'écran où la page se met à défiler
const VITESSE_DEFILEMENT = 14;

// Liste réorganisable par glisser-déposer (souris ou doigt) : on attrape la poignée d'une ligne et on la fait glisser, les autres
// lignes se poussent pour lui faire de la place ; on la lâche et l'ordre est rendu à onReorder(nouvelleListe).
// Au clavier : la poignée prend le focus, flèches haut / bas déplacent la ligne d'un cran.
//
// items : la liste dans l'ordre actuel ; getId(item) : identifiant stable.
// renderItem(item, index, g) : retourne la ligne ; elle doit poser g.ref et g.style sur son élément racine et mettre g.poignee où
//   elle veut (en général au début). g.dragging est vrai pour la ligne qu'on tient.
// Le conteneur (className / style) est celui de la liste d'avant (ex. "admin-list") : les lignes restent ses enfants directs.
export default function ListeReordonnable({ items, getId, onReorder, renderItem, className, style, children }) {
  const { t } = useT();
  const els = useRef(new Map());
  const info = useRef(null); // { startY, startScroll, tops, hs, de }
  const dernierY = useRef(0);
  const raf = useRef(0);
  const [drag, setDrag] = useState(null); // { id, de, vers, dy }

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function calculer() {
    const inf = info.current;
    if (!inf) return null;
    const n = inf.tops.length;
    let dy = dernierY.current - inf.startY + (window.scrollY - inf.startScroll);
    const min = inf.tops[0] - inf.tops[inf.de];
    const max = inf.tops[n - 1] + inf.hs[n - 1] - inf.hs[inf.de] - inf.tops[inf.de];
    dy = Math.max(min, Math.min(max, dy));
    const centre = inf.tops[inf.de] + inf.hs[inf.de] / 2 + dy;
    let vers = 0;
    for (let j = 0; j < n; j++) if (j !== inf.de && inf.tops[j] + inf.hs[j] / 2 < centre) vers++;
    return { de: inf.de, vers, dy };
  }

  function rafraichir() {
    const c = calculer();
    if (c) setDrag((d) => (d ? { ...d, vers: c.vers, dy: c.dy } : d));
  }

  // Tant qu'on tient une ligne près du haut ou du bas de l'écran, la page défile.
  function boucle() {
    if (!info.current) return;
    const y = dernierY.current;
    if (y < MARGE_DEFILEMENT) window.scrollBy(0, -VITESSE_DEFILEMENT);
    else if (y > window.innerHeight - MARGE_DEFILEMENT) window.scrollBy(0, VITESSE_DEFILEMENT);
    rafraichir();
    raf.current = requestAnimationFrame(boucle);
  }

  function fin(valider) {
    const c = valider ? calculer() : null;
    info.current = null;
    cancelAnimationFrame(raf.current);
    document.body.style.userSelect = "";
    setDrag(null);
    if (c && c.vers !== c.de) {
      const nouvelle = [...items];
      const [bouge] = nouvelle.splice(c.de, 1);
      nouvelle.splice(c.vers, 0, bouge);
      onReorder(nouvelle);
    }
  }

  function demarrer(e, index) {
    if (e.button != null && e.button !== 0) return;
    const rects = items.map((it) => els.current.get(getId(it))?.getBoundingClientRect());
    if (rects.some((r) => !r)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    info.current = {
      startY: e.clientY,
      startScroll: window.scrollY,
      tops: rects.map((r) => r.top + window.scrollY),
      hs: rects.map((r) => r.height),
      de: index,
    };
    dernierY.current = e.clientY;
    document.body.style.userSelect = "none";
    setDrag({ id: getId(items[index]), de: index, vers: index, dy: 0 });
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(boucle);
  }

  function auClavier(e, index) {
    const sens = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!sens) return;
    e.preventDefault();
    const cible = index + sens;
    if (cible < 0 || cible >= items.length) return;
    const nouvelle = [...items];
    [nouvelle[index], nouvelle[cible]] = [nouvelle[cible], nouvelle[index]];
    onReorder(nouvelle);
  }

  function styleDe(id, index) {
    if (!drag) return undefined;
    if (id === drag.id) {
      return {
        position: "relative",
        zIndex: 20,
        transform: `translateY(${drag.dy}px)`,
        transition: "none",
        background: "color-mix(in srgb, var(--navy, #0d0d3f) 82%, #fff 18%)",
        boxShadow: "0 14px 34px rgba(0,0,0,.5)",
        borderRadius: 16,
        cursor: "grabbing",
      };
    }
    const h = info.current?.hs[drag.de] || 0;
    let decalage = 0;
    if (drag.de < drag.vers && index > drag.de && index <= drag.vers) decalage = -h;
    if (drag.de > drag.vers && index >= drag.vers && index < drag.de) decalage = h;
    return { position: "relative", transform: decalage ? `translateY(${decalage}px)` : "none", transition: "transform .2s ease" };
  }

  return (
    <div className={className} style={style}>
      {items.map((item, index) => {
        const id = getId(item);
        const g = {
          ref: (el) => {
            if (el) els.current.set(id, el);
            else els.current.delete(id);
          },
          style: styleDe(id, index),
          dragging: drag?.id === id,
          poignee: (
            <button
              type="button"
              className="glisse-poignee"
              aria-label={t("Glisser pour réorganiser")}
              title={t("Glisser pour réorganiser")}
              onPointerDown={(e) => demarrer(e, index)}
              onPointerMove={(e) => {
                if (info.current) dernierY.current = e.clientY;
              }}
              onPointerUp={() => fin(true)}
              onPointerCancel={() => fin(false)}
              onKeyDown={(e) => auClavier(e, index)}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                <circle cx="9" cy="6" r="1.8" />
                <circle cx="15" cy="6" r="1.8" />
                <circle cx="9" cy="12" r="1.8" />
                <circle cx="15" cy="12" r="1.8" />
                <circle cx="9" cy="18" r="1.8" />
                <circle cx="15" cy="18" r="1.8" />
              </svg>
            </button>
          ),
        };
        return renderItem(item, index, g);
      })}
      {children}
    </div>
  );
}
