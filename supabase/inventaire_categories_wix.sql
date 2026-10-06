-- ============================================================
-- Ajout : synchronisation des catégories (collections) de Wix Stores.
-- Les catégories venues de Wix sont repérées par source = 'wix' et leur id
-- Wix (source_id), pour être mises à jour sans doublon à chaque synchro.
-- Les catégories créées dans Gozly restent source = NULL.
-- À exécuter APRÈS inventaire_categories.sql, dans Supabase > SQL Editor.
-- ============================================================

alter table categories_inventaire add column if not exists source text;
alter table categories_inventaire add column if not exists source_id text;

create unique index if not exists categories_inventaire_source_unique
  on categories_inventaire (entreprise_id, source, source_id)
  where source is not null;
