-- ============================================================
-- Ajout : boîte "Planification" dans la page Commandes en ligne
-- (Personnalisation > Commandes en ligne > Planification dans les
-- commandes). Désactivée par défaut ; demande aussi le module Tâches.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists commandes_planning_integre boolean not null default false;
