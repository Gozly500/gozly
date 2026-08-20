-- ============================================================
-- Ajout : panneau admin interne (toi + ton équipe Gozly)
-- Corrige aussi une policy trop permissive trouvée en cours de route.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- SÉCURITÉ : cette policy (qual = true) permettait à N'IMPORTE QUEL compte
-- client connecté de lire les informations de TOUTES les entreprises
-- (nom, adresse, courriel, téléphone, logo, id Stripe), pas juste la
-- sienne. On revient à "sa propre entreprise seulement".
drop policy if exists "Utilisateurs authentifiés peuvent lire les entreprises" on entreprises;
drop policy if exists "Un utilisateur peut lire sa propre entreprise" on entreprises;
create policy "Un utilisateur peut lire sa propre entreprise"
on entreprises
for select
to authenticated
using (id in (select entreprise_id from profils where profils.id = auth.uid()));

-- Table des comptes Gozly (toi + ton équipe) qui ont accès au panneau admin.
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

grant select, insert, delete on admins to authenticated;

drop policy if exists "Les admins peuvent voir la liste des admins" on admins;
create policy "Les admins peuvent voir la liste des admins"
on admins for select
to authenticated
using (exists (select 1 from admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "Les admins peuvent ajouter des admins" on admins;
create policy "Les admins peuvent ajouter des admins"
on admins for insert
to authenticated
with check (exists (select 1 from admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "Les admins peuvent retirer des admins" on admins;
create policy "Les admins peuvent retirer des admins"
on admins for delete
to authenticated
using (exists (select 1 from admins a where a.email = auth.jwt() ->> 'email'));

-- Un admin peut lire/modifier TOUTES les entreprises (en plus de la
-- policy "sa propre entreprise" qui reste pour les clients normaux).
drop policy if exists "Les admins peuvent lire toutes les entreprises" on entreprises;
create policy "Les admins peuvent lire toutes les entreprises"
on entreprises for select
to authenticated
using (exists (select 1 from admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "Les admins peuvent modifier toutes les entreprises" on entreprises;
create policy "Les admins peuvent modifier toutes les entreprises"
on entreprises for update
to authenticated
using (exists (select 1 from admins a where a.email = auth.jwt() ->> 'email'))
with check (exists (select 1 from admins a where a.email = auth.jwt() ->> 'email'));

-- Même chose pour profils (voir/désactiver le compte d'un client).
drop policy if exists "Les admins peuvent lire tous les profils" on profils;
create policy "Les admins peuvent lire tous les profils"
on profils for select
to authenticated
using (exists (select 1 from admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "Les admins peuvent modifier tous les profils" on profils;
create policy "Les admins peuvent modifier tous les profils"
on profils for update
to authenticated
using (exists (select 1 from admins a where a.email = auth.jwt() ->> 'email'))
with check (exists (select 1 from admins a where a.email = auth.jwt() ->> 'email'));

-- Seed : ton compte comme premier admin (remplace par ton courriel si
-- ce n'est pas le bon).
insert into admins (email) values ('guloume501yt@gmail.com')
on conflict (email) do nothing;
