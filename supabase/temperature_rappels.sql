-- Rappels de températures : « N'oubliez pas d'enregistrer les températures » envoyé aux employés au
-- travail, 30 min avant la fin du créneau AM (11 h 30) et PM (23 h 30), si aucun relevé n'a été fait.
-- Réglage dans Personnalisation > Températures. Désactivé par défaut.
alter table entreprises add column if not exists temperature_rappels_actif boolean not null default false;
