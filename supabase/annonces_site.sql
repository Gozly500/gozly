-- ============================================================
-- Annonces du site (page /annonces + bandeau « Dernière annonce » du tableau de bord).
-- Écrites une seule fois dans le panneau admin (onglet Annonces) ; peuvent aussi être envoyées dans Discord.
--
-- 1) Table des annonces.
-- 2) Dossier public « annonces » (Supabase Storage) pour les images jointes aux annonces.
--
-- Les écritures passent par le serveur (clé service_role) : RLS activé sans policy = rien d'accessible
-- directement depuis le navigateur. Les annonces publiées sont lues par le serveur (page /annonces).
--
-- Sûr à réexécuter (if not exists / on conflict).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists annonces_site (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  contenu text not null default '',
  image_url text,                       -- lien public de l'image (Storage)
  image_chemin text,                    -- chemin dans le dossier « annonces » (pour la supprimer)
  publie boolean not null default true, -- false = brouillon (non visible sur le site)
  publie_le timestamptz not null default now(),
  discord_canal_id text,                -- si l'annonce a aussi été envoyée dans Discord
  discord_message_id text,
  cree_par text,
  created_at timestamptz not null default now(),
  maj timestamptz not null default now()
);

create index if not exists annonces_site_publie_idx on annonces_site (publie, publie_le desc);

alter table annonces_site enable row level security;
grant all on annonces_site to service_role;

-- Dossier public pour les images (lecture publique par lien ; l'envoi se fait par le serveur seulement).
insert into storage.buckets (id, name, public)
values ('annonces', 'annonces', true)
on conflict (id) do update set public = true;
