-- ============================================================
-- Ajout : impression automatique des bons de commande sur une imprimante
-- Epson TM-m30III (impression "cloud" Epson Server Direct Print : c'est
-- l'imprimante qui interroge Gozly toutes les quelques secondes pour savoir
-- s'il y a un bon à imprimer - voir /api/impression/epson/[token]).
--
-- - entreprises.impression_actif : l'impression est configurée (booléen lu
--   par l'interface, sans jamais exposer le jeton).
-- - entreprises.impression_token : jeton secret dans l'URL donnée à
--   l'imprimante (service_role seulement, via /api/commandes/impression).
-- - entreprises.impression_commandes_manuelles : 'desactivee', 'manuelle'
--   (bouton Imprimer seulement) ou 'automatique' (imprime dès la création).
-- - commandes_en_ligne.imprime_le : évite d'imprimer deux fois la même
--   commande automatiquement.
-- - bons_impression : la file d'attente des bons à imprimer.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists impression_actif boolean not null default false;
alter table entreprises add column if not exists impression_token text unique;
alter table entreprises add column if not exists impression_commandes_manuelles text not null default 'desactivee';

alter table entreprises drop constraint if exists entreprises_impression_commandes_manuelles_check;
alter table entreprises add constraint entreprises_impression_commandes_manuelles_check
  check (impression_commandes_manuelles in ('desactivee', 'manuelle', 'automatique'));

alter table commandes_en_ligne add column if not exists imprime_le timestamptz;

create table if not exists bons_impression (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  -- NULL pour un bon de test.
  commande_id uuid references commandes_en_ligne(id) on delete cascade,
  type text not null default 'commande' check (type in ('commande', 'test')),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'envoye', 'imprime', 'echec')),
  tentatives integer not null default 0,
  erreur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bons_impression_file_idx on bons_impression (entreprise_id, statut, created_at);

-- Aucune policy pour les utilisateurs : tout passe par les routes serveur
-- (service_role), jamais directement par le navigateur.
alter table bons_impression enable row level security;
grant select, insert, update, delete on bons_impression to service_role;

drop policy if exists "Les admins peuvent tout faire sur bons_impression" on bons_impression;
create policy "Les admins peuvent tout faire sur bons_impression"
on bons_impression for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on bons_impression to authenticated;
