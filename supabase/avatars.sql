-- ============================================================
-- Avatars (petits robots personnalisables) : un avatar par employé
-- (modifié depuis l'app employé) et par compte du tableau de bord.
-- Sauvegardé comme un petit objet JSON (couleurs et pièces choisies),
-- jamais comme une image : rien à stocker.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table employes add column if not exists avatar jsonb;
alter table profils add column if not exists avatar jsonb;
