"use client";

import TexteAnnonce from "@/components/TexteAnnonce";

// Pop-up d'ouverture écrit dans le panneau admin (Annonces > Pop-ups d'ouverture) : « Gozly a été mis à jour », nouveautés...
// Affiche le premier de la liste ; `onVu(id)` est appelé au clic sur le bouton (le parent le retire et le marque comme vu).
// Pas de fermeture par un clic à côté : un message vu par accident ne reviendrait plus.
export default function PopupMiseAJour({ popups, onVu, bouton = "Compris", etiquette = "Nouveauté", compteur }) {
  const popup = popups?.[0];
  if (!popup) return null;
  const nb = popups.length;

  return (
    <div className="modal-overlay popup-app-overlay" role="dialog" aria-modal="true" aria-labelledby="popup-app-titre">
      <div className="modal-card popup-app-carte" key={popup.id}>
        <div className="popup-app-etiquette">
          {etiquette}
          {nb > 1 && compteur ? <span>{compteur(nb)}</span> : null}
        </div>
        <h3 id="popup-app-titre" className="popup-app-titre">
          {popup.titre}
        </h3>
        {popup.contenu && (
          <div className="popup-app-texte annonce-texte">
            <TexteAnnonce texte={popup.contenu} />
          </div>
        )}
        <button type="button" className="submit-btn popup-app-bouton" onClick={() => onVu(popup.id)}>
          {bouton}
        </button>
      </div>
    </div>
  );
}
