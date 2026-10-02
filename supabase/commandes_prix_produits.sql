-- ============================================================
-- Ajout : prix de vente des produits de l'inventaire, pour construire
-- les commandes manuelles à partir des produits (même nom, même prix que
-- sur le site). Rempli automatiquement depuis Wix à la synchronisation
-- (catalogue V1), et modifiable à la main dans Inventaire.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table produits_inventaire add column if not exists prix numeric(10, 2);
