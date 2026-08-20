-- ============================================================
-- Ajout : inscription publique + lien compte utilisateur <-> entreprise
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- Table qui lie chaque compte utilisateur (auth.users) à une entreprise
create table if not exists profils (
  id uuid primary key references auth.users(id) on delete cascade,
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

-- Autorise n'importe qui qui vient de créer un compte (authentifié) à créer
-- SA PROPRE entreprise lors de l'inscription.
create policy "Un utilisateur peut créer son entreprise à l'inscription"
on entreprises
for insert
to authenticated
with check (true);

-- Autorise un utilisateur à créer SON PROPRE profil (lien vers son entreprise),
-- jamais celui d'un autre.
create policy "Un utilisateur peut créer son propre profil"
on profils
for insert
to authenticated
with check (auth.uid() = id);

-- Autorise un utilisateur à lire son propre profil (pour afficher ses infos).
create policy "Un utilisateur peut lire son propre profil"
on profils
for select
to authenticated
using (auth.uid() = id);

-- Autorise un utilisateur à lire les infos de SA PROPRE entreprise.
create policy "Un utilisateur peut lire sa propre entreprise"
on entreprises
for select
to authenticated
using (
  id in (select entreprise_id from profils where profils.id = auth.uid())
);
