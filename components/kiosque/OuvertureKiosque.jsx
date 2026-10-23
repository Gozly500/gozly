"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { lireInstantane, effacerInstantane } from "@/lib/transitionKiosque";
import { useLangue } from "@/components/moi/LangueContext";
import { IconEcran } from "@/components/icons/Pictogrammes";

const DUREE_SORTIE_MS = 320;

// Au changement de page : reproduit, exactement au même endroit, la carte de chargement que la liste des kiosques affichait (même
// si son animation n'était pas finie), puis la fait zoomer et s'effacer pendant que le kiosque arrive en grossissant (.kq-entree).
// Ne fait rien si le kiosque n'a pas été ouvert depuis la liste.
// La photo est lue dans un effet (et non au premier rendu) : React construit le nouveau kiosque AVANT que l'ancienne liste n'ait
// déposé la sienne ; dans la même mise à jour, l'effet vient après, mais avant que l'écran se redessine (aucun éclair).
export default function OuvertureKiosque() {
  const { t } = useLangue();
  const [photo, setPhoto] = useState(null);
  const [sortie, setSortie] = useState(false);
  const [fini, setFini] = useState(false);

  useLayoutEffect(() => {
    const p = lireInstantane();
    if (p) {
      effacerInstantane(); // utilisée une seule fois ; en développement, React rejoue l'effet : la 2e lecture ne trouve rien et n'écrase rien
      setPhoto(p);
    }
  }, []);

  useEffect(() => {
    if (!photo) return;
    // Deux images d'attente : le temps que la copie soit dessinée, puis le zoom part.
    const a = requestAnimationFrame(() => requestAnimationFrame(() => setSortie(true)));
    const b = setTimeout(() => setFini(true), DUREE_SORTIE_MS + 150);
    return () => {
      cancelAnimationFrame(a);
      clearTimeout(b);
    };
  }, [photo]);

  if (!photo || fini) return null;
  const { boite, k, elements, bordure } = photo;
  const pos = (e, extra) => ({ position: "absolute", left: e.l, top: e.t, width: e.w, height: e.h, margin: 0, transformOrigin: "0 0", transform: e.transform, ...extra });

  return (
    <div
      className={`kq-copie${sortie ? " sortie" : ""}`}
      style={{ left: boite.left, top: boite.top, width: boite.width, height: boite.height, transitionDuration: `${DUREE_SORTIE_MS}ms` }}
      aria-hidden="true"
    >
      <div style={{ position: "absolute", left: bordure, top: bordure, right: bordure, bottom: bordure }}>
        <span className="kq-ouv-icone" style={pos(elements.icone)}>
          {k.image ? (
            <img src={k.image} alt="" width={120} height={120} style={{ display: "block", borderRadius: "24px", width: "100%", height: "100%" }} />
          ) : (
            <span style={{ fontSize: "74px", display: "block", lineHeight: 1 }}>{k.icon || <IconEcran className="gozly-icon" />}</span>
          )}
        </span>
        <div className="kq-ouv-titre" style={pos(elements.titre, { whiteSpace: "nowrap", width: elements.titre.w + 2 })}>
          {k.nom}
        </div>
        <div className="kq-ouv-desc" style={pos(elements.desc, { whiteSpace: "nowrap", width: elements.desc.w + 2, maxWidth: "none" })}>
          {k.desc}
        </div>
        <div className="kq-ouv-charge visible" style={{ ...pos(elements.charge), opacity: elements.charge.opacite, marginTop: 0, transition: "none", whiteSpace: "nowrap" }}>
          <span className="kq-spinner" aria-hidden="true" />
          <span>{t("kq.chargement")}</span>
        </div>
      </div>
    </div>
  );
}
