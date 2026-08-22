-- ============================================================
-- Ajout : emplacements (succursales) - Horaire/Pointage/Feuille de temps
-- gérés indépendamment par emplacement quand il y en a plus d'un.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists emplacements (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now()
);

alter table emplacements enable row level security;
grant select, insert, update, delete on emplacements to authenticated;

drop policy if exists "Un utilisateur peut lire les emplacements de son entreprise" on emplacements;
create policy "Un utilisateur peut lire les emplacements de son entreprise"
on emplacements for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut créer des emplacements pour son entreprise" on emplacements;
create policy "Un utilisateur peut créer des emplacements pour son entreprise"
on emplacements for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier les emplacements de son entreprise" on emplacements;
create policy "Un utilisateur peut modifier les emplacements de son entreprise"
on emplacements for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer les emplacements de son entreprise" on emplacements;
create policy "Un utilisateur peut supprimer les emplacements de son entreprise"
on emplacements for delete to authenticated using (est_membre(entreprise_id));

drop policy if exists "Les admins peuvent tout faire sur emplacements" on emplacements;
create policy "Les admins peuvent tout faire sur emplacements"
on emplacements for all to authenticated using (is_admin()) with check (is_admin());

-- Rattache un quart de travail / un pointage à un emplacement précis
-- (nullable : les entreprises à un seul emplacement n'ont rien à
-- changer, tout continue de fonctionner comme avant).
alter table planning_quarts add column if not exists emplacement_id uuid references emplacements(id) on delete set null;
alter table pointages add column if not exists emplacement_id uuid references emplacements(id) on delete set null;
