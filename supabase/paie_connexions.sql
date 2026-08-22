-- ============================================================
-- Ajout : connexions aux services de paie externes (Nethris, et
-- futurs services) pour l'exportation automatique des heures.
--
-- Contrairement aux autres tables, celle-ci ne doit JAMAIS être
-- lisible/écrivable depuis le client (elle contient un mot de passe
-- chiffré) : RLS est activé mais aucune policy n'est créée pour le
-- rôle "authenticated". Seules les routes serveur /api/paie/* (qui
-- utilisent la clé service_role) peuvent y accéder.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists paie_connexions (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  service text not null,
  code_entreprise text not null,
  code_utilisateur text not null,
  mot_de_passe_chiffre text not null,
  statut text not null default 'non_verifie',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entreprise_id, service)
);

alter table paie_connexions enable row level security;

-- Pas de grant/policy pour "authenticated" : la table n'est accessible
-- que via service_role, donc uniquement depuis les routes API serveur.
