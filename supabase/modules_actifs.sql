-- ============================================================
-- Ajout : activation/désactivation des modules par entreprise
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists modules_actifs (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  module text not null,
  created_at timestamptz not null default now(),
  unique (entreprise_id, module)
);

alter table modules_actifs enable row level security;

grant select, insert, delete on modules_actifs to authenticated;

drop policy if exists "Un utilisateur peut lire les modules de son entreprise" on modules_actifs;
create policy "Un utilisateur peut lire les modules de son entreprise"
on modules_actifs for select
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut activer un module pour son entreprise" on modules_actifs;
create policy "Un utilisateur peut activer un module pour son entreprise"
on modules_actifs for insert
to authenticated
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut désactiver un module de son entreprise" on modules_actifs;
create policy "Un utilisateur peut désactiver un module de son entreprise"
on modules_actifs for delete
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Les admins peuvent tout faire sur modules_actifs" on modules_actifs;
create policy "Les admins peuvent tout faire sur modules_actifs"
on modules_actifs for all
to authenticated
using (is_admin())
with check (is_admin());
