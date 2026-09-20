-- ============================================================
-- Ajout : durée de conservation des relevés de température,
-- configurable par entreprise dans Personnalisation > Températures
-- (3, 6 ou 12 mois - 3 par défaut). Le nettoyage lui-même se fait dans
-- /api/cron/nettoyer-temperatures (déclenché quotidiennement par Vercel
-- Cron, voir vercel.json), pas par un trigger Postgres.
--
-- Donne aussi le droit de supprimer à service_role (le cron supprime
-- les vieux relevés) - releves_temperature ne l'avait pas.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists temperature_retention_mois integer not null default 3;

alter table entreprises drop constraint if exists entreprises_temperature_retention_mois_check;
alter table entreprises add constraint entreprises_temperature_retention_mois_check
  check (temperature_retention_mois in (3, 6, 12));

grant select, insert, update, delete on releves_temperature to service_role;
