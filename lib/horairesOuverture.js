import { bornesJour, dateAujourdhui, decalerJour } from "@/lib/commandes";

// L'entreprise est-elle « ouverte » en ce moment ? Sert à mettre en pause les synchronisations automatiques la nuit et les jours fermés.
// Fenêtre : 1 h avant l'ouverture jusqu'à 1 h 30 après la fermeture (comme la fermeture automatique des pointages).
// Sans horaire d'ouverture enregistré (Entreprise > Emplacements), on ne pause jamais : on répond toujours « ouvert ».
export const MARGE_AVANT_MIN = 60;
export const MARGE_APRES_MIN = 90;

function enMinutes(h) {
  const [hh, mm] = String(h).split(":").map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

// Fenêtre d'ouverture (en ms) d'une journée du Québec « AAAA-MM-JJ », ou null si fermé ce jour-là.
function fenetreDuJour(date, horaires) {
  const jourSemaine = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = dimanche
  const h = horaires?.[String(jourSemaine)];
  if (!h?.debut || !h?.fin) return null;
  const base = new Date(bornesJour(date).debut).getTime();
  const debut = base + enMinutes(h.debut) * 60000;
  let fin = base + enMinutes(h.fin) * 60000;
  if (fin <= debut) fin += 24 * 3600 * 1000; // ferme après minuit
  return { debut: debut - MARGE_AVANT_MIN * 60000, fin: fin + MARGE_APRES_MIN * 60000 };
}

export function estOuvertMaintenant(emplacements, emplacementId, maintenant = Date.now()) {
  const liste = (emplacements || []).filter((e) => !emplacementId || e.id === emplacementId);
  if (liste.length === 0 || liste.some((e) => !e.horaires_ouverture)) return true;
  const aujourdhui = dateAujourdhui();
  const jours = [decalerJour(aujourdhui, -1), aujourdhui]; // la veille compte (fermeture après minuit)
  for (const e of liste) {
    for (const j of jours) {
      const f = fenetreDuJour(j, e.horaires_ouverture);
      if (f && maintenant >= f.debut && maintenant <= f.fin) return true;
    }
  }
  return false;
}
