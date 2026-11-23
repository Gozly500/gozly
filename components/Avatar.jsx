"use client";

// Photo de profil d'une personne : l'émoji qu'elle a choisi, sinon l'initiale de son nom sur fond violet.
export default function Avatar({ emoji, nom = "", taille = 40, className = "", titre }) {
  const initiale = (nom || "?").trim().charAt(0).toUpperCase();
  return (
    <span
      className={`avatar${emoji ? "" : " avatar-initiale"} ${className}`.trim()}
      role="img"
      aria-label={titre || nom || "Profil"}
      style={{ width: taille, height: taille, fontSize: emoji ? taille * 0.58 : taille * 0.42 }}
    >
      {emoji || initiale}
    </span>
  );
}
