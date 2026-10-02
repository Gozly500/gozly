-- ============================================================
-- Ajout : import des ventes Wix (en ligne + point de vente) dans le
-- Suivi des ventes - voir /api/ventes/synchroniser. Aucune nouvelle
-- colonne : la table `ventes` a déjà `source` et `source_id`.
--   source = 'wix'     : une ligne par commande en ligne
--   source = 'wix_pos' : une ligne par jour de point de vente
--
-- Les ventes du point de vente n'ont plus besoin d'être copiées une par une
-- dans commandes_en_ligne (le module Commandes ne les affiche pas) : on
-- retire celles déjà copiées pour alléger la base.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

delete from commandes_en_ligne where canal = 'POS';

grant select, insert, update, delete on ventes to service_role;
