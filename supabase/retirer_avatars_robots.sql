-- ============================================================
-- Retrait du système d'avatars robots (remplacé par l'émoji de profil : supabase/employe_emoji.sql).
-- ATTENTION : ceci supprime pour de bon les anciens avatars sauvegardés. À exécuter seulement une fois le nouveau code en ligne.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table employes drop column if exists avatar;
alter table profils drop column if exists avatar;
