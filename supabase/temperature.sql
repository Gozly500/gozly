-- ============================================================
-- Ajout : module Registre de température (conformité MAPAQ) - liste
-- d'équipements (frigos, congélateurs, ...) et relevés de température,
-- saisis depuis le dashboard ou l'app employé (/moi).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists equipements_temperature (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  emplacement_id uuid references emplacements(id) on delete set null,
  nom text not null,
  type text not null default 'refrigerateur', -- voir lib/temperature.js (TYPES_EQUIPEMENT)
  created_at timestamptz not null default now()
);

alter table equipements_temperature enable row level security;
grant select, insert, update, delete on equipements_temperature to authenticated;
grant select on equipements_temperature to service_role;

drop policy if exists "Un utilisateur peut lire les équipements de son entreprise" on equipements_temperature;
create policy "Un utilisateur peut lire les équipements de son entreprise"
on equipements_temperature for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut créer des équipements pour son entreprise" on equipements_temperature;
create policy "Un utilisateur peut créer des équipements pour son entreprise"
on equipements_temperature for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier les équipements de son entreprise" on equipements_temperature;
create policy "Un utilisateur peut modifier les équipements de son entreprise"
on equipements_temperature for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer les équipements de son entreprise" on equipements_temperature;
create policy "Un utilisateur peut supprimer les équipements de son entreprise"
on equipements_temperature for delete to authenticated using (est_membre(entreprise_id));

drop policy if exists "Les admins peuvent tout faire sur equipements_temperature" on equipements_temperature;
create policy "Les admins peuvent tout faire sur equipements_temperature"
on equipements_temperature for all to authenticated using (is_admin()) with check (is_admin());

create table if not exists releves_temperature (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  equipement_id uuid not null references equipements_temperature(id) on delete cascade,
  employe_id uuid references employes(id) on delete set null,
  releve_par text not null, -- nom affiché (employé ou membre du dashboard), conservé même si le compte est supprimé
  temperature numeric not null,
  conforme boolean not null,
  note text,
  created_at timestamptz not null default now()
);

alter table releves_temperature enable row level security;
grant select, insert, delete on releves_temperature to authenticated;
grant select, insert on releves_temperature to service_role;

drop policy if exists "Un utilisateur peut lire les relevés de son entreprise" on releves_temperature;
create policy "Un utilisateur peut lire les relevés de son entreprise"
on releves_temperature for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut ajouter un relevé pour son entreprise" on releves_temperature;
create policy "Un utilisateur peut ajouter un relevé pour son entreprise"
on releves_temperature for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer un relevé de son entreprise" on releves_temperature;
create policy "Un utilisateur peut supprimer un relevé de son entreprise"
on releves_temperature for delete to authenticated using (est_membre(entreprise_id));

drop policy if exists "Les admins peuvent tout faire sur releves_temperature" on releves_temperature;
create policy "Les admins peuvent tout faire sur releves_temperature"
on releves_temperature for all to authenticated using (is_admin()) with check (is_admin());
