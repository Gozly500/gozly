-- ============================================================
-- Magasin d'intégrations : quelles intégrations une entreprise a « installées » (Paramètres > Intégrations > Magasin).
-- Ne change aucun fonctionnement : c'est seulement ce que le client voit dans le menu.
-- Une intégration déjà connectée (Wix, OneDrive, Google Drive, Nethris, clé IA) est comptée installée automatiquement.
--
-- RLS activé sans policy -> accessible uniquement via service_role, depuis /api/integrations/installees.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists integrations_installees (
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  integration_id text not null,
  created_at timestamptz not null default now(),
  primary key (entreprise_id, integration_id)
);

alter table integrations_installees enable row level security;

grant select, insert, update, delete on integrations_installees to service_role;
