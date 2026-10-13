// « Lus » de la messagerie de l'app employé : le dernier message vu par conversation, mémorisé sur l'appareil
// (les employés n'ont pas de compte où l'enregistrer). Partagé par la page Discussion (qui marque les messages
// comme lus en ouvrant une conversation) et la cloche des notifications (qui liste les conversations non lues).
export const CLE_LUS = "gozly_chat_lus";
export const EVENEMENT_LUS = "gozly-chat-lus";

export function lireLus() {
  try {
    return JSON.parse(window.localStorage.getItem(CLE_LUS) || "{}");
  } catch {
    return {};
  }
}

// Jamais initialisé sur cet appareil ? (alors rien n'est « non lu » : on part de l'état actuel plutôt que d'inonder)
export function lusInitialises() {
  try {
    return window.localStorage.getItem(CLE_LUS) !== null;
  } catch {
    return true;
  }
}

// Enregistre et prévient les autres composants de la page (le storage event ne se déclenche pas dans le même onglet).
export function ecrireLus(lus) {
  try {
    window.localStorage.setItem(CLE_LUS, JSON.stringify(lus));
    window.dispatchEvent(new Event(EVENEMENT_LUS));
  } catch {}
}

// Non lu = le dernier message vient de quelqu'un d'autre et est plus récent que celui qu'on a vu.
export function conversationNonLue(c, lus) {
  return !!c.dernierMessageDate && !c.dernierDeMoi && (!lus[c.id] || new Date(c.dernierMessageDate) > new Date(lus[c.id]));
}
