"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Curseur au style Gozly : volume (tableau de bord et kiosque Musique) et barre de progression de la chanson.
// Il suit le doigt en local, et envoie la valeur :
//  - pendant le glissement, dès que le doigt s'arrête 0,3 s (le volume suit, sans inonder Sonos de commandes) ;
//  - à la fin du geste, QUEL QUE SOIT le type de fin. Sur tablette, quand on fait glisser le doigt, le navigateur annule
//    souvent le geste (pointercancel / touchend) au lieu d'envoyer « relâché » : avant, seule la pression directe
//    (un toucher) envoyait la valeur, et le glissement ne changeait rien.
// direct = false : n'envoie qu'à la fin du geste (barre de progression : se déplacer dans la chanson fait sauter le son).
// couleur : barre de progression au dégradé coloré qui défile ; mince : version fine (lecteur compact replié), violette
//   et sans poignée — en passant de mince à normal, la barre grossit et son dégradé apparaît peu à peu (voir .gx-prog).
export default function CurseurVolume({ valeur, onValider, muet = false, label, max = 100, lectureSeule = false, direct = true, couleur = false, mince = false }) {
  const [local, setLocal] = useState(valeur ?? 0);
  const [touche, setTouche] = useState(false); // le doigt est sur la barre : le remplissage suit sans animation
  const glisse = useRef(false); // la valeur locale n'a pas encore été envoyée
  const tient = useRef(false); // un doigt (ou la souris) est sur le curseur
  const dernier = useRef(valeur ?? 0);
  const minuteur = useRef(null);
  const racine = useRef(null);
  const [monte, setMonte] = useState(false);
  const [pos, setPos] = useState(null); // centre de la poignée à l'écran : la bulle (portail, position fixe) s'y accroche

  useEffect(() => setMonte(true), []);

  function placerBulle() {
    const r = racine.current?.getBoundingClientRect();
    if (!r) return;
    const poignee = window.matchMedia("(pointer: coarse)").matches ? 32 : 20;
    const p = max > 0 ? local / max : 0;
    setPos({ x: r.left + poignee / 2 + (r.width - poignee) * p, y: r.top + r.height / 2 });
  }

  // La bulle suit la poignée à chaque changement de valeur ; recalculée aussi au toucher (la page a pu défiler).
  useLayoutEffect(placerBulle, [local, touche, max]);

  // Pendant qu'on touche le curseur, on ignore les mises à jour venues de Sonos (sinon il saute sous le doigt).
  useEffect(() => {
    if (!glisse.current && !tient.current && valeur != null) setLocal(valeur);
  }, [valeur]);

  useEffect(() => () => clearTimeout(minuteur.current), []);

  function envoyer() {
    clearTimeout(minuteur.current);
    if (!glisse.current) return;
    glisse.current = false;
    onValider(dernier.current);
  }

  function fin() {
    tient.current = false;
    setTouche(false);
    envoyer();
  }

  const pct = max > 0 ? (local / max) * 100 : 0;
  const champ = (
    <input
      type="range"
      min="0"
      max={max}
      value={local}
      aria-label={label}
      disabled={valeur == null}
      className={`gx-curseur${couleur ? " gx-curseur-nu" : ""}${muet ? " muet" : ""}${lectureSeule ? " lecture" : ""}`}
      style={{ "--pct": `${pct}%` }}
      onPointerDown={() => {
        tient.current = true;
        setTouche(true);
      }}
      onChange={(e) => {
        const v = Number(e.target.value);
        glisse.current = true;
        dernier.current = v;
        setLocal(v);
        clearTimeout(minuteur.current);
        if (direct) minuteur.current = setTimeout(envoyer, 300);
      }}
      onPointerUp={fin}
      onPointerCancel={fin}
      onTouchEnd={fin}
      onMouseUp={fin}
      onKeyUp={fin}
      onBlur={fin}
    />
  );
  // Volume : une bulle avec la valeur en chiffres sort du curseur (de taille 0, pile sur la poignée) quand on le touche,
  // monte au-dessus de la poignée et la suit pendant le glissement, puis rentre dans la poignée au relâchement.
  if (!couleur) {
    return (
      <div className="gx-vol" ref={racine}>
        {champ}
        {!lectureSeule && monte && pos &&
          createPortal(
            <span className={`gx-bulle${touche ? " ouverte" : ""}`} style={{ left: pos.x, top: pos.y }} aria-hidden="true">
              {local}
            </span>,
            document.body
          )}
      </div>
    );
  }

  return (
    <div className={`gx-prog${mince ? " mince" : ""}${touche ? " touche" : ""}${lectureSeule ? " lecture" : ""}`}>
      <span className="gx-prog-fond">
        <span className="gx-prog-rempli" style={{ width: `${pct}%` }} />
      </span>
      {champ}
    </div>
  );
}
