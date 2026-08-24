-- ============================================================
-- Ajout : contrainte d'unicité pour permettre la synchronisation externe
-- (Wix, etc.) sans créer de doublons à chaque resynchronisation - un même
-- produit source (entreprise + source + source_id) ne peut exister qu'une
-- fois. Les produits créés à la main (source/source_id NULL) ne sont pas
-- affectés : Postgres ne considère jamais deux NULL comme égaux.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'produits_inventaire_source_unique'
  ) then
    alter table produits_inventaire
      add constraint produits_inventaire_source_unique unique (entreprise_id, source, source_id);
  end if;
end $$;
