-- ============================================================
-- Module « Musique » (Sonos) : liaison du compte Sonos d'une entreprise.
--
-- Une ligne par entreprise : les jetons d'accès Sonos (OAuth). Comme
-- wix_connexions et paie_connexions, RLS est activé SANS policy pour
-- « authenticated » : la table n'est accessible que par les routes
-- /api/sonos/* via service_role.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists sonos_connexions (
  entreprise_id uuid primary key references entreprises(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  household_id text,
  cree_par uuid,
  created_at timestamptz not null default now(),
  maj timestamptz not null default now()
);

alter table sonos_connexions enable row level security;
grant all on sonos_connexions to service_role;
