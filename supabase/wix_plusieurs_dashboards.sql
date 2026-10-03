-- ============================================================
-- Ajout : un même site Wix lié à PLUSIEURS dashboards Gozly (ex: un restaurant
-- avec deux succursales : une entreprise Gozly par succursale, un seul site Wix).
--
-- - wix_connexions.instance_id n'est plus unique : plusieurs entreprises
--   peuvent partager la même installation de l'app Wix (une ligne par
--   entreprise, toujours unique par entreprise_id).
-- - entreprises.wix_lieu_nom : la succursale Wix (businessLocation.name)
--   dont ce dashboard reçoit les commandes et les ventes. NULL = toutes.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table wix_connexions drop constraint if exists wix_connexions_instance_id_key;

alter table entreprises add column if not exists wix_lieu_nom text;
