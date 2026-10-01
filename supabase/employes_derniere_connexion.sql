-- ============================================================
-- Ajout : suivi de la dernière connexion d'un employé à l'app mobile
-- "Gozly Équipe" - permet au propriétaire de voir, dans Entreprise >
-- Employés, qui a déjà ouvert l'application et qui ne l'a jamais fait.
--
-- Volontairement sur "employes" (pas sur employe_sessions, qui est
-- supprimée à la déconnexion) - cette valeur survit donc à une
-- déconnexion/reconnexion et donne un vrai historique.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table employes add column if not exists derniere_connexion timestamptz;
