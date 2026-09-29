-- ============================================================
-- Ajout : (1) approbation automatique/manuelle pour les congés, comme ça
-- existait déjà pour les échanges (auto_approuver_echanges) ; (2) une case
-- "Désactivé" pour chacune des deux fonctionnalités, indépendamment l'une
-- de l'autre.
--
-- Colonnes additives seulement (pas de changement de type sur les colonnes
-- existantes) pour ne rien casser de ce qui lit déjà auto_approuver_echanges.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists echanges_actif boolean not null default true;
alter table entreprises add column if not exists conges_actif boolean not null default true;
alter table entreprises add column if not exists auto_approuver_conges boolean not null default false;
