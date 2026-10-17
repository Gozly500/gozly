-- ============================================================
-- Tickets du site (page /aide/tickets) : une personne connectée ouvre un ticket, l'équipe répond depuis
-- le panneau admin (onglet Support > Tickets, avec ceux de Discord).
--
-- Tout passe par le serveur (clé service_role) : RLS activé sans aucune policy = rien d'accessible
-- directement depuis le navigateur.
--
-- Sûr à réexécuter (if not exists).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists tickets_site (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sujet text not null,
  statut text not null default 'ouvert' check (statut in ('ouvert', 'ferme')),
  dernier_auteur text not null default 'client' check (dernier_auteur in ('client', 'equipe')),
  created_at timestamptz not null default now(),
  maj timestamptz not null default now()
);

create table if not exists tickets_site_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets_site(id) on delete cascade,
  auteur text not null check (auteur in ('client', 'equipe')),
  texte text not null,
  created_at timestamptz not null default now()
);

create index if not exists tickets_site_user_idx on tickets_site (user_id, created_at desc);
create index if not exists tickets_site_messages_idx on tickets_site_messages (ticket_id, created_at);

alter table tickets_site enable row level security;
alter table tickets_site_messages enable row level security;

grant all on tickets_site to service_role;
grant all on tickets_site_messages to service_role;
