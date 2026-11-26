-- ============================================================
-- Commandes en ligne :
--  - commandes_traiter_auto : « Traiter automatiquement à l'acceptation » (la commande est traitée chez Wix dès le premier bouton).
--  - impression_copies : nombre de copies de chaque bon de commande (1 à 5).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists commandes_traiter_auto boolean not null default false;
alter table entreprises add column if not exists impression_copies smallint not null default 1;
