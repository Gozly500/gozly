-- ============================================================
-- Votes (référendums) du serveur Discord de Gozly.
-- Un vote = un message de Gozyx dans le salon "référendums" avec les boutons Pour / Contre.
-- Les bulletins sont anonymes pour les membres (seul le décompte s'affiche), mais on garde
-- "qui a voté quoi" ici pour empêcher le double vote et permettre de changer d'avis.
--
-- Tout passe par le serveur (clé service_role) : RLS activé sans aucune policy = rien d'accessible
-- depuis le navigateur.
--
-- Sûr à réexécuter (if not exists).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists votes_discord (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  channel_id text not null,
  titre text not null,
  description text not null default '',
  reserve boolean not null default false,   -- true = seulement les membres avec le rôle "Compte lié"
  ferme boolean not null default false,
  fin_le timestamptz,                       -- fin prévue (null = pas de limite)
  cree_par text,
  created_at timestamptz not null default now()
);

create table if not exists votes_discord_bulletins (
  vote_id uuid not null references votes_discord(id) on delete cascade,
  discord_user_id text not null,
  choix text not null check (choix in ('pour', 'contre')),
  updated_at timestamptz not null default now(),
  primary key (vote_id, discord_user_id)
);

alter table votes_discord enable row level security;
alter table votes_discord_bulletins enable row level security;

grant all on votes_discord to service_role;
grant all on votes_discord_bulletins to service_role;
