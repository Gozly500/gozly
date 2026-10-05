-- ============================================================
-- Ajout : mode d'affichage du kiosque des commandes, au choix dans
-- Personnalisation > Commandes en ligne :
--   'liste'    : une seule liste de cartes (commandes du jour) - par défaut ;
--   'sections' : 3 sections En attente / Traitées / Terminées.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists commandes_kiosque_mode text not null default 'liste';
