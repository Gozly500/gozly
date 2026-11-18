// Section de présentation d'un module sur la page d'accueil : le titre et la
// phrase sont du vrai texte (traduisible, léger), et seul l'élément principal
// (boîte, calendrier, etc.) est une image SVG sur fond transparent.
// `accent` (violet | cyan | orange | pink) colore le halo et le titre ;
// `puces` = 2-3 mots-clés courts sous la phrase.
export default function ModuleVitrine({
  id,
  titre,
  texte,
  image,
  alt,
  inverse = false,
  accent = "violet",
  numero,
  puces = [],
}) {
  return (
    <section id={id} className={`vitrine vit-${accent}${inverse ? " vitrine-inverse" : ""}`}>
      <div className="wrap">
        <div className="vitrine-wrap rv">
          <div className="vitrine-texte">
            {numero && <span className="vitrine-num">{numero}</span>}
            <h2 className="vitrine-titre">{titre}</h2>
            <p>{texte}</p>
            {puces.length > 0 && (
              <ul className="vitrine-puces">
                {puces.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="vitrine-visuel">
            <div className="vitrine-tilt">
              <img src={image} alt={alt} loading="lazy" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
