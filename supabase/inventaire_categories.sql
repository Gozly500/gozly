-- ============================================================
-- Ajout : catégories de produits dans l'Inventaire.
-- - categories_inventaire : les catégories d'une entreprise (nom + ordre d'affichage).
-- - produits_inventaire.categorie_id : la catégorie d'un produit (si la catégorie
--   est supprimée, le produit passe simplement « Sans catégorie »).
-- La synchronisation Wix ne touche pas à la catégorie des produits.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists categories_inventaire (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom text not null,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

alter table categories_inventaire enable row level security;
grant select, insert, update, delete on categories_inventaire to authenticated;
grant all on categories_inventaire to service_role;

drop policy if exists "Un utilisateur peut lire les categories d'inventaire de son entreprise" on categories_inventaire;
create policy "Un utilisateur peut lire les categories d'inventaire de son entreprise"
on categories_inventaire for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut creer des categories d'inventaire" on categories_inventaire;
create policy "Un utilisateur peut creer des categories d'inventaire"
on categories_inventaire for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier les categories d'inventaire" on categories_inventaire;
create policy "Un utilisateur peut modifier les categories d'inventaire"
on categories_inventaire for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer les categories d'inventaire" on categories_inventaire;
create policy "Un utilisateur peut supprimer les categories d'inventaire"
on categories_inventaire for delete to authenticated using (est_membre(entreprise_id));

drop policy if exists "Les admins peuvent tout faire sur categories_inventaire" on categories_inventaire;
create policy "Les admins peuvent tout faire sur categories_inventaire"
on categories_inventaire for all to authenticated using (is_admin()) with check (is_admin());

alter table produits_inventaire add column if not exists categorie_id uuid references categories_inventaire(id) on delete set null;
