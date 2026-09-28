-- ============================================================
-- Ajout : coordonnées GPS de l'adresse de l'entreprise elle-même (distinct
-- de celles des succursales dans "emplacements", qui existaient déjà).
-- Même mécanisme que pour les succursales (voir lib/geocode.js) : quand
-- l'adresse est enregistrée depuis Paramètres > Informations (client) ou le
-- panneau admin > Clients, elle est convertie en coordonnées via Nominatim.
-- Pas encore utilisées par une fonctionnalité (pas de vérification GPS au
-- niveau de l'entreprise) - stockées pour la cohérence des données et une
-- éventuelle utilisation future (ex: carte, distance entre entreprises).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists latitude double precision;
alter table entreprises add column if not exists longitude double precision;
