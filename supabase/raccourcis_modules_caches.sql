-- ============================================================
-- Ajout : choisir lesquels des modules actifs apparaissent comme
-- raccourci dans le widget "Raccourcis des modules" du tableau de
-- bord - sans désactiver le module lui-même (ça reste uniquement via
-- "Gérer les modules" dans la barre latérale).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists raccourcis_modules_caches text[] not null default '{}';
