-- ============================================================
-- Ajout : mode de calcul des heures de pointage
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- 'reel'    = les heures sont calculées à partir de l'heure réelle où
--             l'employé pointe (comportement actuel).
-- 'horaire' = si l'employé pointe avant l'heure prévue à son quart
--             (planning_quarts.heure_debut), le calcul des heures part
--             de l'heure prévue plutôt que de l'heure réelle de pointage.
--             S'il pointe après l'heure prévue (ou qu'aucun quart n'est
--             planifié ce jour-là pour lui), l'heure réelle est utilisée.
alter table entreprises add column if not exists pointage_calcul_mode text not null default 'reel';
