"use client";

// Blocs gris qui brillent pendant le chargement (à la place du logo qui tourne) : on voit déjà la forme de la page.
// nb : nombre de blocs ; haut : hauteur d'un bloc en px.
export default function Squelettes({ nb = 5, haut = 84 }) {
  return (
    <div className="moi-squelettes" role="status" aria-busy="true">
      {Array.from({ length: nb }, (_, i) => (
        <div key={i} className="moi-squelette" style={{ "--haut": `${haut}px` }} />
      ))}
    </div>
  );
}
