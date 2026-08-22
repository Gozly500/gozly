-- ============================================================
-- Ajout : téléphone/courriel sur la fiche employé + association à un
-- ou plusieurs emplacements (pour filtrer qui apparaît dans l'Horaire
-- de chaque succursale).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table employes add column if not exists telephone text;
alter table employes add column if not exists courriel text;

-- Planning (tâches) devient lui aussi filtrable par emplacement.
alter table taches add column if not exists emplacement_id uuid references emplacements(id) on delete set null;

create table if not exists employe_emplacements (
  employe_id uuid not null references employes(id) on delete cascade,
  emplacement_id uuid not null references emplacements(id) on delete cascade,
  primary key (employe_id, emplacement_id)
);

alter table employe_emplacements enable row level security;
grant select, insert, delete on employe_emplacements to authenticated;

drop policy if exists "Un utilisateur peut lire les associations de son entreprise" on employe_emplacements;
create policy "Un utilisateur peut lire les associations de son entreprise"
on employe_emplacements for select
to authenticated
using (exists (select 1 from employes e where e.id = employe_id and est_membre(e.entreprise_id)));

drop policy if exists "Un utilisateur peut créer des associations pour son entreprise" on employe_emplacements;
create policy "Un utilisateur peut créer des associations pour son entreprise"
on employe_emplacements for insert
to authenticated
with check (exists (select 1 from employes e where e.id = employe_id and est_membre(e.entreprise_id)));

drop policy if exists "Un utilisateur peut supprimer des associations de son entreprise" on employe_emplacements;
create policy "Un utilisateur peut supprimer des associations de son entreprise"
on employe_emplacements for delete
to authenticated
using (exists (select 1 from employes e where e.id = employe_id and est_membre(e.entreprise_id)));

drop policy if exists "Les admins peuvent tout faire sur employe_emplacements" on employe_emplacements;
create policy "Les admins peuvent tout faire sur employe_emplacements"
on employe_emplacements for all
to authenticated
using (is_admin())
with check (is_admin());
