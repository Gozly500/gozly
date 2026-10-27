"use client";

import TexteAnnonce from "@/components/TexteAnnonce";

// Pop-up d'ouverture écrit dans le panneau admin (Annonces > Pop-ups d'ouverture) : « Gozly a été mis à jour », nouveautés...
// Affiche le premier de la liste ; `onVu(id)` est appelé au clic sur le bouton (le parent le retire et le marque comme vu ;
// il peut renvoyer une promesse). Le pop-up peut avoir un bouton de lien (boutonTexte / boutonUrl) : le cliquer compte aussi comme « vu ».
// Pas de fermeture par un clic à côté : un message vu par accident ne reviendrait plus.
// apercu : (panneau admin) le lien ne mène nulle part. langue : "fr" | "en" (version anglaise facultative : titreEn, contenuEn, boutonTexteEn).
export default function PopupMiseAJour({ popups, onVu, bouton = "Compris", etiquette = "Nouveauté", compteur, apercu = false, langue = "fr" }) {
  const brut = popups?.[0];
  if (!brut) return null;
  // Version anglaise si la personne est en anglais ET qu'elle existe ; sinon la française.
  const anglais = langue === "en" && !!brut.titreEn;
  const popup = anglais
    ? { ...brut, titre: brut.titreEn, contenu: brut.contenuEn || "", boutonTexte: brut.boutonTexteEn || brut.boutonTexte }
    : brut;
  const nb = popups.length;
  const lien = popup.boutonTexte && popup.boutonUrl ? popup.boutonUrl : null;
  const externe = !!lien && /^https?:\/\//i.test(lien);

  function clicLien(e) {
    if (apercu) {
      e.preventDefault();
      return onVu(popup.id);
    }
    if (externe) return void onVu(popup.id); // s'ouvre dans un nouvel onglet : l'app reste là, on la marque « vu » en parallèle
    // Page de l'app : on attend que le « vu » soit enregistré avant de changer de page (sinon la requête pourrait être coupée).
    e.preventDefault();
    Promise.resolve(onVu(popup.id)).finally(() => window.location.assign(lien));
  }

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
        {lien && (
          <a className="submit-btn popup-app-bouton" href={lien} target={externe ? "_blank" : undefined} rel={externe ? "noopener noreferrer" : undefined} onClick={clicLien}>
            {popup.boutonTexte}
          </a>
        )}
        <button type="button" className={lien ? "admin-icon-btn popup-app-bouton" : "submit-btn popup-app-bouton"} onClick={() => onVu(popup.id)}>
          {bouton}
        </button>
      </div>
    </div>
  );
}
