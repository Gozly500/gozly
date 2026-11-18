// Décor de fond des pages publiques (hors accueil, qui a le sien dans le hero) : lueurs
// animées + gros carrés flous aux teintes chaudes, fixes derrière le contenu. Placé par Nav.
export default function PageDecor() {
  return (
    <div className="page-decor" aria-hidden="true">
      <i className="pd-k1" />
      <i className="pd-k2" />
      <i className="pd-k3" />
      <i className="pd-a1" />
      <i className="pd-a2" />
      <i className="pd-a3" />
    </div>
  );
}
