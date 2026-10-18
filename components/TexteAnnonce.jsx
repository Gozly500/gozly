// Affiche le texte d'une annonce : paragraphes, listes (lignes qui commencent par « - »), **gras**, *italique* et liens.
// Aucun HTML brut n'est accepté : tout passe par des éléments React (pas de dangerouslySetInnerHTML).

const JETONS = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s<]+)/g;

function inline(texte, cle) {
  return texte.split(JETONS).map((morceau, i) => {
    const k = `${cle}-${i}`;
    if (!morceau) return null;
    if (morceau.startsWith("**") && morceau.endsWith("**") && morceau.length > 4) return <strong key={k}>{morceau.slice(2, -2)}</strong>;
    if (morceau.startsWith("*") && morceau.endsWith("*") && morceau.length > 2) return <em key={k}>{morceau.slice(1, -1)}</em>;
    const md = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(morceau);
    if (md)
      return (
        <a key={k} href={md[2]} target="_blank" rel="noopener noreferrer">
          {md[1]}
        </a>
      );
    if (/^https?:\/\//.test(morceau))
      return (
        <a key={k} href={morceau} target="_blank" rel="noopener noreferrer">
          {morceau}
        </a>
      );
    return morceau;
  });
}

export default function TexteAnnonce({ texte }) {
  const blocs = String(texte || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="annonce-texte">
      {blocs.map((bloc, i) => {
        const lignes = bloc.split("\n");
        if (lignes.every((l) => /^\s*[-•]\s+/.test(l))) {
          return (
            <ul key={i}>
              {lignes.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ""), `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lignes.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l, `${i}-${j}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
