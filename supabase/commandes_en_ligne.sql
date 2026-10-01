-- ============================================================
-- Ajout : module Commandes en ligne - copie (lecture seule) des
-- commandes reçues sur Wix (plus tard Shopify, Uber Eats, Skip...)
-- pour les afficher sur le dashboard et garder l'historique.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists commandes_en_ligne (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  -- Plateforme d'origine ('wix' pour l'instant) + id de la commande là-bas :
  -- sert à mettre à jour la même ligne à chaque synchronisation.
  source text not null,
  source_id text not null,
  numero text,
  -- Statuts tels que rapportés par la plateforme (ex Wix : APPROVED,
  -- CANCELED, PENDING / PAID, NOT_PAID / FULFILLED, NOT_FULFILLED).
  statut text,
  statut_paiement text,
  statut_preparation text,
  -- 'ramassage', 'livraison' ou NULL si la plateforme ne le dit pas.
  mode text,
  client_nom text,
  client_courriel text,
  sous_total numeric(10, 2),
  taxes numeric(10, 2),
  total numeric(10, 2) not null default 0,
  -- [{ nom, quantite, prix, options: [..] }]
  items jsonb not null default '[]'::jsonb,
  date_commande timestamptz not null,
  -- Commande telle que renvoyée par la plateforme, pour pouvoir afficher
  -- de nouveaux champs plus tard sans tout resynchroniser.
  brut jsonb,
  updated_at timestamptz not null default now(),
  unique (entreprise_id, source, source_id)
);

create index if not exists commandes_en_ligne_date_idx
  on commandes_en_ligne (entreprise_id, date_commande desc);

alter table commandes_en_ligne enable row level security;
grant select on commandes_en_ligne to authenticated;

-- Lecture seulement côté client : les écritures passent par la route
-- serveur /api/commandes/synchroniser (service_role).
drop policy if exists "Un utilisateur peut lire les commandes de son entreprise" on commandes_en_ligne;
create policy "Un utilisateur peut lire les commandes de son entreprise"
on commandes_en_ligne for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Les admins peuvent tout faire sur commandes_en_ligne" on commandes_en_ligne;
create policy "Les admins peuvent tout faire sur commandes_en_ligne"
on commandes_en_ligne for all to authenticated using (is_admin()) with check (is_admin());
