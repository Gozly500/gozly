-- ============================================================
-- Ajout : tâches automatiques à partir des commandes en ligne.
-- Pour chaque jour où des commandes sont à ramasser, Gozly crée une
-- tâche par produit avec le total à préparer (ex: "Pizza au tomate × 6")
-- dans la catégorie "Commandes à ramasser" du module Tâches.
-- Cocher la tâche veut dire "préparé" (la commande, elle, se termine dans
-- le kiosque quand le client la récupère).
--
-- - taches.source / source_cle / source_qte : marquent une tâche générée
--   par les commandes (source = 'commande'), la clé du produit (+ options)
--   et la quantité totale - pour la mettre à jour sans toucher aux tâches
--   que l'équipe a créées elle-même.
-- - entreprises.commandes_vers_taches : interrupteur dans Personnalisation
--   > Commandes en ligne (activé par défaut ; ne fait rien si le module
--   Tâches n'est pas actif).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table taches add column if not exists source text;
alter table taches add column if not exists source_cle text;
alter table taches add column if not exists source_qte integer;

create index if not exists taches_source_idx on taches (entreprise_id, source, date);

alter table entreprises add column if not exists commandes_vers_taches boolean not null default true;

grant select, insert, update, delete on taches to service_role;
grant select, insert, update, delete on categories to service_role;
