-- ============================================================
-- Connexions IA, partie 2 : OAuth ("Se connecter avec Gozly").
-- Le client ajoute seulement l'adresse du connecteur dans son assistant IA (ChatGPT, Claude...), clique « Autoriser » dans
-- une fenêtre Gozly, et n'a plus de clé à copier. À exécuter APRÈS supabase/ia_connexions.sql.
--
-- ia_oauth_clients : les assistants qui se sont enregistrés (inscription dynamique, sans secret : clients publics + PKCE).
-- ia_oauth_codes   : codes d'autorisation à usage unique (10 minutes). On ne garde que leur empreinte.
-- ia_cles          : une connexion OAuth = une ligne de plus (jeton d'accès 1 h + jeton de renouvellement 60 jours, en empreintes).
--
-- Comme ia_cles : RLS activé sans policy -> accessible uniquement via service_role, depuis les routes /api/ia/*.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table ia_cles add column if not exists oauth boolean not null default false;
alter table ia_cles add column if not exists oauth_client_id text;
alter table ia_cles add column if not exists client_nom text;
alter table ia_cles add column if not exists expire_le timestamptz;            -- fin de validité du jeton d'accès
alter table ia_cles add column if not exists refresh_hash text unique;         -- empreinte du jeton de renouvellement
alter table ia_cles add column if not exists refresh_expire_le timestamptz;

create table if not exists ia_oauth_clients (
  client_id text primary key,
  client_nom text not null,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

create table if not exists ia_oauth_codes (
  code_hash text primary key,
  client_id text not null references ia_oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  ecriture boolean not null default false,
  expire_le timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ia_oauth_codes_expire_idx on ia_oauth_codes (expire_le);

alter table ia_oauth_clients enable row level security;
alter table ia_oauth_codes enable row level security;

grant select, insert, update, delete on ia_oauth_clients to service_role;
grant select, insert, update, delete on ia_oauth_codes to service_role;
