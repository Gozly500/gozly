-- ============================================================
-- Ajout : sessions de l'app mobile employé ("Gozly Équipe"). Un employé
-- se connecte une fois sur son téléphone (code d'entreprise + NIP) et
-- reste connecté via ce jeton.
--
-- Comme paie_connexions.sql : cette table ne doit JAMAIS être
-- lisible/écrivable depuis le client (le token, une fois haché, reste
-- la seule preuve d'identité de l'employé). RLS activé, aucune policy
-- pour "authenticated" - accessible uniquement via service_role, donc
-- uniquement depuis les routes /api/employe-app/*.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists employe_sessions (
  id uuid primary key default gen_random_uuid(),
  employe_id uuid not null references employes(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  derniere_utilisation timestamptz not null default now()
);

alter table employe_sessions enable row level security;
