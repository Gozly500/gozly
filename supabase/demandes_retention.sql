-- ============================================================
-- Ajout : durée de conservation des demandes (congés + échanges de
-- quart) traitées, configurable par entreprise dans Personnalisation >
-- Horaire & Pointage. Le nettoyage lui-même se fait dans
-- /api/cron/nettoyer-demandes (déclenché quotidiennement par Vercel Cron,
-- voir vercel.json), pas par un trigger Postgres.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists demandes_retention_mois integer not null default 6;
