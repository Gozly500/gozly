// Périodes : { id, employeId, debut, fin (dates ISO incluses), de, a ("HH:MM" ou null = toute la journée), note, non (true = PAS disponible) }.
// La période qui compte pour une personne un jour donné : « pas disponible » l'emporte, puis « toute la journée ».
export const dispoDe = (periodes, employeId, iso) => {
  const siennes = periodes.filter((p) => String(p.employeId) === String(employeId) && p.debut <= iso && p.fin >= iso);
  return siennes.find((p) => p.non) || siennes.find((p) => !p.de) || siennes[0] || null;
};

// Classes CSS d'une période : « non » (rouge) l'emporte sur « partiel » (jaune) ; sinon vert.
export const genreDispo = (p) => (!p ? "" : p.non ? " non" : p.de ? " partiel" : "");

// Le texte d'une case : les heures, ou « Disponible » / « Pas disponible ».
export const texteDispo = (p, t) => {
  const heures = heuresDispo(p);
  if (p.non) return heures ? `${t("Pas disponible")} ${heures}` : t("Pas disponible");
  return heures || t("Disponible");
};

export const heuresDispo = (p) => (p.de && p.a ? `${p.de} - ${p.a}` : null);

// Ligne de la table disponibilites -> période.
export const periodeDeLigne = (l) => ({
  id: l.id,
  employeId: l.employe_id,
  debut: l.date_debut,
  fin: l.date_fin,
  de: l.heure_debut ? l.heure_debut.slice(0, 5) : null,
  a: l.heure_fin ? l.heure_fin.slice(0, 5) : null,
  note: l.note || "",
  non: l.disponible === false,
});

// Midi : évite qu'un changement d'heure fasse glisser la date d'une journée.
export const dateDe = (iso) => new Date(`${iso}T12:00:00`);
export const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const plusJours = (iso, n) => {
  const d = dateDe(iso);
  d.setDate(d.getDate() + n);
  return isoDe(d);
};
