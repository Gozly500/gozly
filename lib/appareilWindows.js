// Réglages de l'appareil dans l'app Windows du kiosque : l'app expose un « pont » (window.GozlyWindows, voir electron/preload.js du kiosque Windows)
// pour le volume, la luminosité, le Bluetooth, le Wi-Fi et les paramètres de Windows. Hors de cette app (navigateur, tablette Android),
// le pont n'existe pas et rien de tout ça ne s'affiche.

export function pontWindows() {
  return typeof window !== "undefined" && window.GozlyWindows ? window.GozlyWindows : null;
}

export function dansAppWindows() {
  return !!pontWindows();
}
