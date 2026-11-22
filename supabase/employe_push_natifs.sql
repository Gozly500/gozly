-- ============================================================
-- Ajout : jetons de notifications push NATIVES (app Android "Gozly Équipe").
-- Un jeton FCM par appareil ; un employé peut en avoir plusieurs.
--
-- Comme employe_push_subscriptions : RLS activé, aucune policy -
-- accessible uniquement via service_role (routes /api/employe-app/notifications/*
-- et lib/pushNatif.js).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists employe_push_natifs (
  id uuid primary key default gen_random_uuid(),
  employe_id uuid not null references employes(id) on delete cascade,
  token text not null unique,
  plateforme text not null default 'android',
  created_at timestamptz not null default now()
);

create index if not exists employe_push_natifs_employe on employe_push_natifs (employe_id);

alter table employe_push_natifs enable row level security;

grant select, insert, update, delete on employe_push_natifs to service_role;
