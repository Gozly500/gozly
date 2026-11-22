-- ============================================================
-- Ajout : émoji de profil des employés (« photo de profil » simple de l'app
-- native Gozly Équipe, en attendant les avatars robots).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table employes add column if not exists emoji text;
