"use client";

const TEXTES_FR = {
  vu: "Vu",
  vuPar: (noms) => `Vu par ${noms}`,
  ecrit: (nom) => `${nom} écrit`,
  ecritDeux: (a, b) => `${a} et ${b} écrivent`,
  ecritPlusieurs: "Plusieurs personnes écrivent",
};

// Texte "Vu" sous mon dernier message, ou null s'il n'a pas encore été vu.
// directe : conversation à deux (juste "Vu"), sinon les noms de ceux qui l'ont vu.
export function libelleVu({ vus, dernierMessageIso, directe, textes = TEXTES_FR }) {
  if (!dernierMessageIso) return null;
  const limite = new Date(dernierMessageIso).getTime();
  const noms = vus.filter((v) => new Date(v.luAt).getTime() >= limite).map((v) => v.nom);
  if (noms.length === 0) return null;
  if (directe) return textes.vu;
  const affiches = noms.length > 3 ? `${noms.slice(0, 2).join(", ")} +${noms.length - 2}` : noms.join(", ");
  return textes.vuPar(affiches);
}

export function LigneVu({ texte }) {
  return texte ? <div className="chat-vu">{texte}</div> : null;
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
