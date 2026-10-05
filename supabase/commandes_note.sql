-- ============================================================
-- Ajout : "Info supplémentaire" sur les commandes saisies à la main
-- (app employé, app gestionnaire, kiosque, dashboard). Affichée sur les
-- cartes de commande, dans le PDF et sur le bon de commande imprimé.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table commandes_en_ligne add column if not exists note text;
