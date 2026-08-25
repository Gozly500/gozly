-- ============================================================
-- Ajout : liste de réapprovisionnement + mode kiosk (Inventaire)
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- Liste partagée d'items "à aller chercher" (ex: au magasin, à l'entrepôt).
-- Une ligne = un item ajouté à la liste. Cocher/supprimer l'item sur
-- l'écran kiosk retire simplement la ligne - pas d'historique conservé,
-- même logique que le tableau blanc + photo utilisés avant.
create table if not exists demandes_reappro (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  -- Optionnel : lien vers un produit existant de l'Inventaire (coché dans
  -- la liste des produits). NULL si l'item a été tapé librement (pas
  -- encore dans le catalogue).
  produit_id uuid references produits_inventaire(id) on delete set null,
  nom text not null,
  quantite numeric not null default 1,
  created_at timestamptz not null default now()
);

alter table demandes_reappro enable row level security;
grant select, insert, update, delete on demandes_reappro to authenticated;

drop policy if exists "Un utilisateur peut lire les demandes de réappro de son entreprise" on demandes_reappro;
create policy "Un utilisateur peut lire les demandes de réappro de son entreprise"
on demandes_reappro for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut ajouter des demandes de réappro pour son entreprise" on demandes_reappro;
create policy "Un utilisateur peut ajouter des demandes de réappro pour son entreprise"
on demandes_reappro for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier les demandes de réappro de son entreprise" on demandes_reappro;
create policy "Un utilisateur peut modifier les demandes de réappro de son entreprise"
on demandes_reappro for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer les demandes de réappro de son entreprise" on demandes_reappro;
create policy "Un utilisateur peut supprimer les demandes de réappro de son entreprise"
on demandes_reappro for delete to authenticated using (est_membre(entreprise_id));

drop policy if exists "Les admins peuvent tout faire sur demandes_reappro" on demandes_reappro;
create policy "Les admins peuvent tout faire sur demandes_reappro"
on demandes_reappro for all to authenticated using (is_admin()) with check (is_admin());
