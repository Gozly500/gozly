-- ============================================================
-- Horaire : modèle d'affichage choisi par l'entreprise ('classique' ou 'tableau').
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists horaire_modele text not null default 'classique';
