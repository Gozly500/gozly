-- ============================================================
-- Refonte du module Températures : catégories (comme Planning),
-- équipements classés dedans, et relevés par créneau (AM avant midi,
-- PM de midi à minuit) au lieu d'un journal en continu.
-- À exécuter APRÈS supabase/temperature.sql, dans Supabase > SQL Editor.
-- ============================================================

create table if not exists categories_temperature (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now()
);

alter table categories_temperature enable row level security;
grant select, insert, update, delete on categories_temperature to authenticated;
grant select on categories_temperature to service_role;

drop policy if exists "Un utilisateur peut lire ses catégories de température" on categories_temperature;
create policy "Un utilisateur peut lire ses catégories de température"
on categories_temperature for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut créer ses catégories de température" on categories_temperature;
create policy "Un utilisateur peut créer ses catégories de température"
on categories_temperature for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier ses catégories de température" on categories_temperature;
create policy "Un utilisateur peut modifier ses catégories de température"
on categories_temperature for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer ses catégories de température" on categories_temperature;
create policy "Un utilisateur peut supprimer ses catégories de température"
on categories_temperature for delete to authenticated using (est_membre(entreprise_id));

drop policy if exists "Les admins peuvent tout faire sur categories_temperature" on categories_temperature;
create policy "Les admins peuvent tout faire sur categories_temperature"
on categories_temperature for all to authenticated using (is_admin()) with check (is_admin());

alter table equipements_temperature add column if not exists categorie_id uuid references categories_temperature(id) on delete set null;

-- Un relevé par équipement, par jour, par créneau (am/pm) - remplace le
-- journal en continu par une grille à remplir 2x/jour. "date_relevee" est
-- la date du créneau (pas forcément celle de created_at si jamais on
-- corrige un relevé plus tard).
alter table releves_temperature add column if not exists date_relevee date not null default current_date;
alter table releves_temperature add column if not exists periode text not null default 'am' check (periode in ('am','pm'));

-- Des relevés de test peuvent déjà exister en double pour un même
-- équipement/date/créneau (avant l'ajout de la contrainte ci-dessous) -
-- on les vide, ce sont forcément des données de test à ce stade-ci.
truncate table releves_temperature;

alter table releves_temperature drop constraint if exists releves_temperature_equip_date_periode_key;
alter table releves_temperature add constraint releves_temperature_equip_date_periode_key unique (equipement_id, date_relevee, periode);
