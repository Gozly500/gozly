-- ============================================================
-- Ajout : lier chaque succursale (emplacement) Gozly à une succursale Wix.
-- Les commandes Wix d'un lieu vont à la succursale liée ; un dashboard dont toutes
-- les succursales sont liées ne reçoit que les commandes de ces lieux.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table emplacements add column if not exists wix_lieu_nom text;
