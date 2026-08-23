-- ============================================================
-- Ajout : Inventaire (gestion de stock manuelle) - produits avec
-- quantité et seuil d'alerte de stock bas.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists produits_inventaire (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom text not null,
  sku text,
  quantite integer not null default 0,
  seuil_alerte integer not null default 0,
  notes text,
  -- Hooks pour une future synchronisation externe (Shopify, Wix, ...).
  -- Non utilisés pour l'instant - restent NULL pour tous les produits
  -- créés manuellement depuis le dashboard.
  source text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table produits_inventaire enable row level security;
grant select, insert, update, delete on produits_inventaire to authenticated;

drop policy if exists "Un utilisateur peut lire les produits de son entreprise" on produits_inventaire;
create policy "Un utilisateur peut lire les produits de son entreprise"
on produits_inventaire for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut créer des produits pour son entreprise" on produits_inventaire;
create policy "Un utilisateur peut créer des produits pour son entreprise"
on produits_inventaire for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier les produits de son entreprise" on produits_inventaire;
create policy "Un utilisateur peut modifier les produits de son entreprise"
on produits_inventaire for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer les produits de son entreprise" on produits_inventaire;
create policy "Un utilisateur peut supprimer les produits de son entreprise"
on produits_inventaire for delete to authenticated using (est_membre(entreprise_id));

drop policy if exists "Les admins peuvent tout faire sur produits_inventaire" on produits_inventaire;
create policy "Les admins peuvent tout faire sur produits_inventaire"
on produits_inventaire for all to authenticated using (is_admin()) with check (is_admin());
