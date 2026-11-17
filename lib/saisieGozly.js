import { dansAppWindows } from "@/lib/appareilWindows";

// Faut-il utiliser le clavier / calendrier de Gozly plutôt que ceux du système ? Oui sur un écran tactile (tablette Android),
// dans l'app Windows du kiosque (comme sur la tablette : un écran tactile de comptoir n'a pas toujours de clavier Windows à l'écran),
// ou avec ?saisie=gozly pour l'essayer sur un ordinateur.
export function saisieGozlyActive() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || new URLSearchParams(window.location.search).get("saisie") === "gozly" || dansAppWindows();
}
