-- ============================================================
-- Ajout : module Horaire & Pointage
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- NIP à 4 chiffres par employé, pour s'identifier sur l'écran de pointage.
-- Unique par entreprise (deux employés de la même entreprise ne peuvent
-- pas avoir le même NIP, mais deux entreprises différentes peuvent
-- réutiliser le même NIP sans conflit).
alter table employes add column if not exists nip text;

drop index if exists employes_entreprise_nip_unique;
create unique index employes_entreprise_nip_unique on employes (entreprise_id, nip) where nip is not null;

-- Horaire (quarts de travail assignés à un employé, pour une date donnée).
alter table planning_quarts enable row level security;
grant select, insert, update, delete on planning_quarts to authenticated;

drop policy if exists "Un utilisateur peut lire les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut lire les quarts de son entreprise"
on planning_quarts for select
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut ajouter des quarts à son entreprise" on planning_quarts;
create policy "Un utilisateur peut ajouter des quarts à son entreprise"
on planning_quarts for insert
to authenticated
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut modifier les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut modifier les quarts de son entreprise"
on planning_quarts for update
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()))
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut supprimer les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut supprimer les quarts de son entreprise"
on planning_quarts for delete
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Les admins peuvent tout faire sur planning_quarts" on planning_quarts;
create policy "Les admins peuvent tout faire sur planning_quarts"
on planning_quarts for all
to authenticated
using (is_admin())
with check (is_admin());

-- Pointages (arrivée/départ horodatés par employé).
create table if not exists pointages (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  employe_id uuid not null references employes(id) on delete cascade,
  type text not null check (type in ('arrivee','depart')),
  horodatage timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table pointages enable row level security;
grant select, insert, update, delete on pointages to authenticated;

drop policy if exists "Un utilisateur peut lire les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut lire les pointages de son entreprise"
on pointages for select
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut ajouter des pointages à son entreprise" on pointages;
create policy "Un utilisateur peut ajouter des pointages à son entreprise"
on pointages for insert
to authenticated
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut modifier les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut modifier les pointages de son entreprise"
on pointages for update
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()))
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut supprimer les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut supprimer les pointages de son entreprise"
on pointages for delete
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Les admins peuvent tout faire sur pointages" on pointages;
create policy "Les admins peuvent tout faire sur pointages"
on pointages for all
to authenticated
using (is_admin())
with check (is_admin());
