-- ============================================================
-- Ajout : numéro d'employé pour l'exportation de la paie (Nethris,
-- et futurs services de paie). Sert à faire correspondre chaque
-- employé de Gozly avec sa fiche dans le système de paie.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table employes add column if not exists numero_paie text;
