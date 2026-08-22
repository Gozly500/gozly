-- ============================================================
-- Correctif : le rôle service_role (utilisé par toutes les routes
-- serveur /api/* pour contourner les RLS) n'avait jamais reçu les
-- droits Postgres sur les tables créées via SQL brut dans ce projet -
-- le contournement des RLS (bypassrls) ne dispense PAS des GRANT
-- normaux, ce sont deux mécanismes séparés.
--
-- Ça touchait : la connexion de l'app employé (table employes), mais
-- aussi - déjà en production - le webhook Stripe (entreprises) et le
-- panneau admin (entreprises, profils, membres). Ce script donne à
-- service_role les droits sur toutes les tables existantes ET futures
-- du schéma public, pour que ce bug ne revienne plus à chaque nouvelle
-- table.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
