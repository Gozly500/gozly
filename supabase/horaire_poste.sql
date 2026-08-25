-- ============================================================
-- Ajout : poste optionnel sur les quarts de travail (Horaire)
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- Champ libre optionnel (ex: nom de machine, département, station) pour
-- préciser à quoi un employé est assigné pendant son quart. NULL si non
-- renseigné - aucun impact sur les quarts existants.
alter table planning_quarts add column if not exists poste text;
