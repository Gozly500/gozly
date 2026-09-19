"use client";

import { useEffect, useRef } from "react";

// À 60 images/s, l'écran est entièrement couvert par le grand cercle de
// l'animation entre les images ~36 et 60 (0,6 s à 1 s) ; l'image 50 (0,83 s)
// est au milieu de cette fenêtre : c'est le bon moment pour changer le
// thème sans que ça se voie, le cercle révèle ensuite le nouveau thème.
const IMAGE_MILIEU = 50;
const FILET_MS = 5000;

function hexVersLottie(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => +(v / 255).toFixed(4));
}

// Le cercle de l'animation est noir -> bleu dans le fichier source : on le
// recolore avec le dégrader du thème choisi ([navy, indigo, purple]).
function colorerCercle(data, couleurs) {
  const gf = data.layers?.find((l) => l.ind === 19)?.shapes?.find((s) => s.ty === "gf");
  if (!gf || !couleurs || couleurs.length < 3) return;
  const [a, b, c] = couleurs.map(hexVersLottie);
  gf.g.p = 3;
  gf.g.k.k = [0, ...a, 0.45, ...b, 1, ...c];
}

// Transition plein écran jouée quand on change de thème. `onMilieu` est appelé
// quand l'écran est entièrement couvert (c'est là qu'on applique le thème),
// `onFin` quand l'animation est terminée.
export default function TransitionTheme({ couleurs, onMilieu, onFin }) {
  const lottieRef = useRef(null);
  const rappels = useRef({});
  rappels.current = { onMilieu, onFin };

  useEffect(() => {
    let anim;
    let annule = false;
    let milieuFait = false;
    let finFait = false;

    const milieu = () => {
      if (milieuFait) return;
      milieuFait = true;
      rappels.current.onMilieu?.();
    };
    const fin = () => {
      milieu();
      if (finFait) return;
      finFait = true;
      rappels.current.onFin?.();
    };

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      fin();
      return;
    }

    (async () => {
      try {
        const [{ default: lottie }, res] = await Promise.all([
          import("lottie-web"),
          fetch("/animations/transition-theme.json"),
        ]);
        const data = await res.json();
        if (annule || !lottieRef.current) return;
        colorerCercle(data, couleurs);
        anim = lottie.loadAnimation({
          container: lottieRef.current,
          renderer: "svg",
          loop: false,
          autoplay: true,
          animationData: data,
        });
        anim.addEventListener("enterFrame", (e) => {
          if (e.currentTime >= IMAGE_MILIEU) milieu();
        });
        anim.addEventListener("complete", fin);
      } catch {
        fin();
      }
    })();

    const filet = setTimeout(fin, FILET_MS);

    return () => {
      annule = true;
      clearTimeout(filet);
      anim?.destroy();
    };
  }, []);

  return (
    <div className="transition-theme" aria-hidden="true">
      <div className="transition-theme-cadre">
        <div ref={lottieRef} className="transition-theme-lottie"></div>
      </div>
    </div>
  );
}
