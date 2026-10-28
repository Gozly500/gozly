-- ============================================================
-- Conservation des relevés de température : les choix deviennent
-- 1, 3 ou 6 mois (le choix 12 mois disparaît, 1 mois s'ajoute).
-- Les entreprises qui étaient à 12 mois passent à 6 mois.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

update entreprises set temperature_retention_mois = 6 where temperature_retention_mois = 12;

alter table entreprises drop constraint if exists entreprises_temperature_retention_mois_check;
alter table entreprises add constraint entreprises_temperature_retention_mois_check
  check (temperature_retention_mois in (1, 3, 6));
