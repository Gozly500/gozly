"use client";

import { useEffect, useState } from "react";

function detecterIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function dejaInstallee() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Bouton "Installer l'app" pour l'écran de connexion employé - évite à
// l'employé de devoir trouver "Ajouter à l'écran d'accueil" dans les menus
// du navigateur lui-même. Sur Android/Chrome, un vrai popup d'installation
// s'ouvre ; sur iPhone (Safari ne permet pas de le déclencher par code), on
// affiche plutôt un petit guide illustré des 3 étapes à suivre.
export default function InstallerApp() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [estIOS, setEstIOS] = useState(false);
  const [installee, setInstallee] = useState(true);
  const [guideOuvert, setGuideOuvert] = useState(false);

  useEffect(() => {
    setInstallee(dejaInstallee());
    setEstIOS(detecterIOS());

    function onBeforeInstall(e) {
      e.preventDefault();
      setPromptEvent(e);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function handleClick() {
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") setInstallee(true);
      setPromptEvent(null);
      return;
    }
    setGuideOuvert(true);
  }

  if (installee || (!promptEvent && !estIOS)) return null;

  return (
    <>
      <button type="button" className="admin-icon-btn" style={{ width: "100%", marginTop: "16px" }} onClick={handleClick}>
        📲 Installer l'app sur cet appareil
      </button>

      {guideOuvert && (
        <div className="modal-overlay" onClick={() => setGuideOuvert(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Installer l'app</h3>
              <button className="admin-icon-btn" onClick={() => setGuideOuvert(false)}>
                Fermer
              </button>
            </div>
            <p className="panel-hint">
              1. Appuie sur le bouton <strong>Partager</strong> (⬆️) en bas de Safari.
              <br />
              2. Choisis <strong>« Sur l'écran d'accueil »</strong>.
              <br />
              3. Appuie sur <strong>Ajouter</strong>.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
