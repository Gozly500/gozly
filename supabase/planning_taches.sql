-- ============================================================
-- Ajout : module Planning v2 - tâches par catégorie et par journée
-- (remplace l'idée initiale d'horaire d'employés)
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now()
);

create table if not exists taches (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  categorie_id uuid references categories(id) on delete set null,
  date date not null,
  texte text not null,
  terminee boolean not null default false,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table taches enable row level security;

grant select, insert, update, delete on categories to authenticated;
grant select, insert, update, delete on taches to authenticated;

-- Catégories : scellées à sa propre entreprise.
drop policy if exists "Un utilisateur peut lire ses catégories" on categories;
create policy "Un utilisateur peut lire ses catégories"
on categories for select
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut créer ses catégories" on categories;
create policy "Un utilisateur peut créer ses catégories"
on categories for insert
to authenticated
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut modifier ses catégories" on categories;
create policy "Un utilisateur peut modifier ses catégories"
on categories for update
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()))
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut supprimer ses catégories" on categories;
create policy "Un utilisateur peut supprimer ses catégories"
on categories for delete
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Les admins peuvent tout faire sur categories" on categories;
create policy "Les admins peuvent tout faire sur categories"
on categories for all
to authenticated
using (is_admin())
with check (is_admin());

-- Tâches : même principe.
drop policy if exists "Un utilisateur peut lire ses tâches" on taches;
create policy "Un utilisateur peut lire ses tâches"
on taches for select
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut créer ses tâches" on taches;
create policy "Un utilisateur peut créer ses tâches"
on taches for insert
to authenticated
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut modifier ses tâches" on taches;
create policy "Un utilisateur peut modifier ses tâches"
on taches for update
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()))
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut supprimer ses tâches" on taches;
create policy "Un utilisateur peut supprimer ses tâches"
on taches for delete
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Les admins peuvent tout faire sur taches" on taches;
create policy "Les admins peuvent tout faire sur taches"
on taches for all
to authenticated
using (is_admin())
with check (is_admin());
