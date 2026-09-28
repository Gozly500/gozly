// Image de fond de la section d'en-tête (Accueil) - parfaitement statique
// (aucun mouvement, aucun JS) : c'est le reste de la page qui défile
// normalement par-dessus et vient la recouvrir en scrollant.
export default function HeroParallax({ src }) {
  return (
    <div className="hero-parallax-bg" aria-hidden="true">
      <img src={src} alt="" />
    </div>
  );
}
