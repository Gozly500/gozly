"use client";

// Tuile du logo d'une intégration. Les logos d'une seule couleur (Simple Icons) sont teintés à la couleur de la marque ;
// les logos en couleurs (OneDrive, Nethris, Dayforce) s'affichent tels quels. Sans logo : l'initiale.
export default function LogoIntegration({ i, className = "" }) {
  const style = { "--teinte": i.teinte };
  if (!i.logo) {
    return (
      <span className={`magasin-tuile ${className}`} style={style} aria-hidden="true">
        {i.nom.charAt(0)}
      </span>
    );
  }
  if (i.logoMono) {
    return (
      <span className={`magasin-tuile ${className}`} style={{ ...style, "--logo": `url(${i.logo})` }} aria-hidden="true">
        <span className="logo-masque" />
      </span>
    );
  }
  return (
    <span className={`magasin-tuile logo-image${i.logoPlein ? " plein" : ""} ${className}`} style={style} aria-hidden="true">
      <img src={i.logo} alt="" />
    </span>
  );
}
