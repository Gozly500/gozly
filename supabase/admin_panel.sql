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

-- Pour la suppression réelle d'un compte client depuis le panneau admin.
grant delete on entreprises to service_role;
grant delete on profils to service_role;

-- Une policy RLS sur "admins" qui vérifie l'appartenance en interrogeant
-- la table "admins" elle-même crée une boucle infinie (chaque lecture
-- redéclenche la policy, qui relit la table, qui redéclenche la policy...).
-- La solution standard : passer par une fonction "security definer", qui
-- contourne RLS pour cette seule vérification interne.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from admins a where a.email = auth.jwt() ->> 'email');
$$;

drop policy if exists "Les admins peuvent voir la liste des admins" on admins;
create policy "Les admins peuvent voir la liste des admins"
on admins for select
to authenticated
using (is_admin());

drop policy if exists "Les admins peuvent ajouter des admins" on admins;
create policy "Les admins peuvent ajouter des admins"
on admins for insert
to authenticated
with check (is_admin());

drop policy if exists "Les admins peuvent retirer des admins" on admins;
create policy "Les admins peuvent retirer des admins"
on admins for delete
to authenticated
using (is_admin());

-- Un admin peut lire/modifier TOUTES les entreprises (en plus de la
-- policy "sa propre entreprise" qui reste pour les clients normaux).
drop policy if exists "Les admins peuvent lire toutes les entreprises" on entreprises;
create policy "Les admins peuvent lire toutes les entreprises"
on entreprises for select
to authenticated
using (is_admin());

drop policy if exists "Les admins peuvent modifier toutes les entreprises" on entreprises;
create policy "Les admins peuvent modifier toutes les entreprises"
on entreprises for update
to authenticated
using (is_admin())
with check (is_admin());

-- Même chose pour profils (voir/désactiver le compte d'un client).
drop policy if exists "Les admins peuvent lire tous les profils" on profils;
create policy "Les admins peuvent lire tous les profils"
on profils for select
to authenticated
using (is_admin());

drop policy if exists "Les admins peuvent modifier tous les profils" on profils;
create policy "Les admins peuvent modifier tous les profils"
on profils for update
to authenticated
using (is_admin())
with check (is_admin());

-- Seed : ton compte comme premier admin (remplace par ton courriel si
-- ce n'est pas le bon).
insert into admins (email) values ('guloume501yt@gmail.com')
on conflict (email) do nothing;
