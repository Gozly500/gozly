// Capture d'écran d'un logiciel dans un cadre de fenêtre (barre de titre avec les trois points) : sert aux pages /telecharger et /logiciels.
export default function FenetreApp({ src, alt, titre, largeur, hauteur, className = "", priorite = false }) {
  return (
    <div className={`fenetre-app ${className}`}>
      <div className="fenetre-barre" aria-hidden="true">
        <i />
        <i />
        <i />
        <b>{titre}</b>
      </div>
      <img src={src} alt={alt} width={largeur} height={hauteur} loading={priorite ? "eager" : "lazy"} decoding="async" />
    </div>
  );
}
