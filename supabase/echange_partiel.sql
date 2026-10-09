-- Échange d'une PARTIE d'un quart : l'employé donne seulement une plage d'heures (ex. 12:00–14:00 d'un
-- quart 09:00–17:00) et garde le reste. À l'approbation, le quart est découpé en 2 ou 3 morceaux
-- (avant / échangé / après). Colonnes vides = quart complet (comportement d'avant).
alter table demandes_echange add column if not exists heure_debut time;
alter table demandes_echange add column if not exists heure_fin time;
