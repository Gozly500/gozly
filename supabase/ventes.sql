-- ============================================================
-- Ajout : module Suivi des ventes - un journal des ventes par source
-- (Wix, Moneris, comptant, autre) avec conciliation par période.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists ventes (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  source text not null,
  montant numeric(10, 2) not null,
  date date not null,
  description text,
  -- Hook pour la future synchronisation automatique (ex: commandes Wix) -
  -- NULL pour toute vente entrée à la main. Sert à éviter les doublons
  -- si une même vente est réimportée.
  source_id text,
  created_at timestamptz not null default now(),
  unique (entreprise_id, source, source_id)
);

alter table ventes enable row level security;
grant select, insert, update, delete on ventes to authenticated;

drop policy if exists "Un utilisateur peut lire les ventes de son entreprise" on ventes;
create policy "Un utilisateur peut lire les ventes de son entreprise"
on ventes for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut créer des ventes pour son entreprise" on ventes;
create policy "Un utilisateur peut créer des ventes pour son entreprise"
on ventes for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier les ventes de son entreprise" on ventes;
create policy "Un utilisateur peut modifier les ventes de son entreprise"
on ventes for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer les ventes de son entreprise" on ventes;
create policy "Un utilisateur peut supprimer les ventes de son entreprise"
on ventes for delete to authenticated using (est_membre(entreprise_id));

drop policy if exists "Les admins peuvent tout faire sur ventes" on ventes;
create policy "Les admins peuvent tout faire sur ventes"
on ventes for all to authenticated using (is_admin()) with check (is_admin());
