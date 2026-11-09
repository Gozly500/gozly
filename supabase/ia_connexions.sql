-- ============================================================
-- Connexions IA : clés d'accès qu'un propriétaire génère pour brancher un assistant IA (ChatGPT, Claude...)
-- sur son entreprise Gozly (Paramètres > Intégrations > Intelligence artificielle).
--
-- ia_cles    : on ne garde JAMAIS la clé en clair, seulement son empreinte (SHA-256). La clé complète n'est montrée qu'une fois, à la création.
-- ia_journal : ce que l'IA a fait avec une clé (chaque outil appelé), pour que le propriétaire puisse suivre.
--
-- Comme stockage_connexions : RLS activé sans policy pour "authenticated" -> accessible uniquement via service_role,
-- depuis les routes /api/ia/*.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists ia_cles (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom text not null,
  prefixe text not null,                       -- début de la clé, pour la reconnaître dans la liste
  cle_hash text not null unique,               -- SHA-256 (hex) de la clé complète
  ecriture boolean not null default false,     -- false = lecture seule ; true = peut créer des BROUILLONS d'horaire (jamais publier)
  cree_par uuid references auth.users(id) on delete set null,
  derniere_utilisation timestamptz,
  revoquee boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ia_cles_entreprise_idx on ia_cles (entreprise_id, created_at desc);

create table if not exists ia_journal (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  cle_id uuid references ia_cles(id) on delete cascade,
  outil text not null,
  resume text,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ia_journal_cle_idx on ia_journal (cle_id, created_at desc);
create index if not exists ia_journal_entreprise_idx on ia_journal (entreprise_id, created_at desc);

alter table ia_cles enable row level security;
alter table ia_journal enable row level security;

grant select, insert, update, delete on ia_cles to service_role;
grant select, insert, update, delete on ia_journal to service_role;
