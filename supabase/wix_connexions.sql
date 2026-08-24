-- ============================================================
-- Ajout : connexion de l'inventaire Wix Stores d'une entreprise à Gozly.
--
-- Contrairement à Nethris (identifiants entrés à la main), l'app Wix de
-- Gozly utilise l'authentification "instance" de Wix : quand le client
-- clique "Connecter Wix", on crée une ligne "en_attente" ici (avant même
-- qu'il aille sur Wix), et c'est le webhook "App Instance Installed"
-- (/api/wix/webhook) qui vient remplir `instance_id` une fois l'app
-- installée côté Wix - Wix ne nous donne aucun moyen natif de faire
-- correspondre "telle installation" à "telle entreprise" (pas de state/
-- redirect dans le flux OAuth recommandé), donc on fait correspondre la
-- plus vieille ligne "en_attente" sans instance_id encore assignée.
--
-- Comme paie_connexions, RLS est activé mais sans policy pour
-- "authenticated" : accessible uniquement via service_role, depuis les
-- routes /api/wix/*.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists wix_connexions (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  instance_id text unique,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'connecte')),
  created_at timestamptz not null default now(),
  unique (entreprise_id)
);

alter table wix_connexions enable row level security;

-- Pas de grant/policy pour "authenticated" : la table n'est accessible
-- que via service_role, donc uniquement depuis les routes API serveur.
