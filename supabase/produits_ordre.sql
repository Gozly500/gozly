-- ============================================================
-- Ordre des produits dans une catégorie (Inventaire > Produits > « Réorganiser »)
-- produits_inventaire.ordre : numéro d'affichage du produit dans sa catégorie (1, 2, 3...). Les variantes d'un même produit
-- partagent le même numéro. Vide = pas encore classé (le produit vient après les produits classés, par ordre alphabétique).
-- Ce même ordre est utilisé dans le catalogue du kiosque, du dashboard et de l'app employé.
-- Sûr à réexécuter.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table produits_inventaire add column if not exists ordre integer;
