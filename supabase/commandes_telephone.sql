-- ============================================================
-- Ajout : numéro de téléphone du client sur les commandes saisies à la
-- main (app employé et dashboard). Affiché dans la liste des réservations
-- et sur le bon de commande imprimé.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table commandes_en_ligne add column if not exists client_telephone text;
