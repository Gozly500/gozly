-- ============================================================
-- Ajout : préférence de synchronisation Wix (Personnalisation) - pousser
-- automatiquement vers Wix les produits ajoutés/modifiés/supprimés dans
-- Gozly, ou seulement à la demande (manuel).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists wix_push_auto boolean not null default false;
