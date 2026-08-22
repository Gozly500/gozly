-- ============================================================
-- Ajout : préférence de personnalisation - jour de début de semaine
-- (Horaire & Pointage), configurable par entreprise.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises
  add column if not exists premier_jour_semaine text not null default 'lundi';
