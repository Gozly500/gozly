-- ============================================================
-- Annonces : un message du propriétaire mis en évidence en haut de l'app employé, pendant la durée
-- qu'il choisit (24 h, 3 jours, 1 semaine, 2 semaines, 1 mois). Créées depuis le dashboard
-- (Discussion > + Nouveau > Annonce), lues par les employés via /api/employe-app/annonces.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists annonces (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  contenu text not null,
  debut timestamptz not null default now(),
  fin timestamptz not null,
  cree_par uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (fin > debut)
);

create index if not exists annonces_entreprise_fin on annonces (entreprise_id, fin);

alter table annonces enable row level security;
grant select, insert, delete on annonces to authenticated;
grant select, insert, update, delete on annonces to service_role;

drop policy if exists "Un membre peut lire les annonces de son entreprise" on annonces;
create policy "Un membre peut lire les annonces de son entreprise"
on annonces for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un membre peut publier des annonces pour son entreprise" on annonces;
create policy "Un membre peut publier des annonces pour son entreprise"
on annonces for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un membre peut retirer les annonces de son entreprise" on annonces;
create policy "Un membre peut retirer les annonces de son entreprise"
on annonces for delete to authenticated using (est_membre(entreprise_id));
