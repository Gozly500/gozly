"use client";

import { useState } from "react";

const TEXTES_FR = {
  vu: "Vu",
  vuPar: (noms) => `Vu par ${noms}`,
  vuNombre: (n) => `Vu par ${n} personnes`,
  ecrit: (nom) => `${nom} écrit`,
  ecritDeux: (a, b) => `${a} et ${b} écrivent`,
  ecritPlusieurs: "Plusieurs personnes écrivent",
};

// "Vu" sous mon dernier message : { texte, noms } ou null s'il n'a pas encore été vu.
// directe : conversation à deux (juste "Vu"). Sinon les noms (3 au maximum),
// et au-delà "Vu par N personnes" (on appuie dessus pour voir qui).
export function libelleVu({ vus, dernierMessageIso, directe, textes = TEXTES_FR }) {
  if (!dernierMessageIso) return null;
  const limite = new Date(dernierMessageIso).getTime();
  const noms = vus.filter((v) => new Date(v.luAt).getTime() >= limite).map((v) => v.nom);
  if (noms.length === 0) return null;
  if (directe) return { texte: textes.vu, noms: [] };
  return { texte: noms.length > 3 ? textes.vuNombre(noms.length) : textes.vuPar(noms.join(", ")), noms };
}

export function LigneVu({ vu }) {
  const [ouvert, setOuvert] = useState(false);
  if (!vu) return null;
  // Cliquable seulement quand les noms ne sont pas déjà tous affichés.
  const cliquable = vu.noms.length > 3;
  return (
    <div className="chat-vu-bloc">
      {cliquable ? (
        <button type="button" className="chat-vu chat-vu-bouton" onClick={() => setOuvert((o) => !o)}>
          {vu.texte}
        </button>
      ) : (
        <div className="chat-vu">{vu.texte}</div>
      )}
      {cliquable && ouvert && <div className="chat-vu-noms">{vu.noms.join(", ")}</div>}
    </div>
  );
}

export function IndicateurEcriture({ ecrivent, textes = TEXTES_FR }) {
  if (!ecrivent || ecrivent.length === 0) return null;
  const texte =
    ecrivent.length === 1
      ? textes.ecrit(ecrivent[0])
      : ecrivent.length === 2
        ? textes.ecritDeux(ecrivent[0], ecrivent[1])
        : textes.ecritPlusieurs;
  return (
    <div className="chat-ecrit">
      <span>{texte}</span>
      <span className="chat-ecrit-points">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
