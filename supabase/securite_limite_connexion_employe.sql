-- ============================================================
-- Ajout : limite le nombre de tentatives de connexion (code d'entreprise
-- + NIP) pour empêcher un essai systématique des 10 000 combinaisons de
-- NIP possibles (4 chiffres). Voir app/api/employe-app/connexion/route.js.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists employe_connexion_tentatives (
  id uuid primary key default gen_random_uuid(),
  code_acces text not null,
  created_at timestamptz not null default now()
);

create index if not exists employe_connexion_tentatives_code_idx
  on employe_connexion_tentatives (code_acces, created_at);

-- RLS activé sans aucune policy pour authenticated/anon : seul service_role
-- (qui contourne RLS) peut lire/écrire cette table, personne d'autre.
alter table employe_connexion_tentatives enable row level security;
