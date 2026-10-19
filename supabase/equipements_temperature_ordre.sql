-- ============================================================
-- Ajout : ordre des équipements de température (monter / descendre dans
-- Températures > Équipements, comme les catégories de tâches). Cet ordre
-- est repris par la page Températures et par l'app employé.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table equipements_temperature add column if not exists ordre integer not null default 0;
