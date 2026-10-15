// Section de présentation d'un module sur la page d'accueil : le titre et la
// phrase sont du vrai texte (traduisible, léger), et seul l'élément principal
// (boîte, calendrier, etc.) est une image SVG sur fond transparent.
export default function ModuleVitrine({ id, titre, texte, image, alt, inverse = false }) {
  return (
    <section id={id} className={`vitrine${inverse ? " vitrine-inverse" : ""}`}>
      <div className="wrap vitrine-wrap">
        <div className="vitrine-texte">
          <h2 className="vitrine-titre">{titre}</h2>
          <p>{texte}</p>
        </div>
        <div className="vitrine-visuel">
          <img src={image} alt={alt} loading="lazy" />
        </div>
      </div>
    </section>
  );
}
