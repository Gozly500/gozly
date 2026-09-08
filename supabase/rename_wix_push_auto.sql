-- ============================================================
-- Crée entreprises.sync_produits_auto (remplace wix_push_auto, qui
-- n'existait en fait jamais dans cette base - le script d'origine
-- supabase/wix_push_auto.sql n'avait jamais été exécuté, d'où l'échec
-- de sauvegarde du réglage "Synchronisation vers Wix" dans Personnalisation).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists sync_produits_auto boolean not null default false;
