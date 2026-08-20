-- ============================================================
-- Ajout : page Paramètres du compte (informations, contact, logo,
-- abonnement Stripe, désactivation de compte)
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- Colonnes de contact + logo sur l'entreprise
alter table entreprises add column if not exists adresse text;
alter table entreprises add column if not exists courriel_contact text;
alter table entreprises add column if not exists telephone text;
alter table entreprises add column if not exists logo_url text;

-- Colonnes liées à Stripe (rempli automatiquement à la première visite
-- de l'onglet Abonnement)
alter table entreprises add column if not exists stripe_customer_id text;
alter table entreprises add column if not exists stripe_subscription_id text;

-- Colonnes sur le profil utilisateur
alter table profils add column if not exists telephone_perso text;
alter table profils add column if not exists desactive boolean not null default false;

-- Jusqu'ici on ne pouvait que créer/lire son profil et son entreprise,
-- jamais les modifier. Nécessaire pour que la page Paramètres fonctionne.
-- (drop policy if exists rend ce script rejouable sans erreur)
drop policy if exists "Un utilisateur peut modifier son propre profil" on profils;
create policy "Un utilisateur peut modifier son propre profil"
on profils
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Un utilisateur peut modifier sa propre entreprise" on entreprises;
create policy "Un utilisateur peut modifier sa propre entreprise"
on entreprises
for update
to authenticated
using (id in (select entreprise_id from profils where profils.id = auth.uid()))
with check (id in (select entreprise_id from profils where profils.id = auth.uid()));

-- Bucket de stockage pour les logos d'entreprise (public en lecture,
-- écriture réservée aux comptes connectés)
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "Logos publiquement visibles" on storage.objects;
create policy "Logos publiquement visibles"
on storage.objects for select
to public
using (bucket_id = 'logos');

drop policy if exists "Un utilisateur connecté peut ajouter un logo" on storage.objects;
create policy "Un utilisateur connecté peut ajouter un logo"
on storage.objects for insert
to authenticated
with check (bucket_id = 'logos');

drop policy if exists "Un utilisateur connecté peut remplacer un logo" on storage.objects;
create policy "Un utilisateur connecté peut remplacer un logo"
on storage.objects for update
to authenticated
using (bucket_id = 'logos');

drop policy if exists "Un utilisateur connecté peut supprimer un logo" on storage.objects;
create policy "Un utilisateur connecté peut supprimer un logo"
on storage.objects for delete
to authenticated
using (bucket_id = 'logos');

-- Permet aussi aux comptes connectés d'envoyer un message (ex: demande de
-- suppression de compte depuis la page Paramètres) — jusqu'ici seuls les
-- visiteurs non connectés (anon) pouvaient utiliser messages_contact.
drop policy if exists "Permettre l'envoi de messages de contact (connecté)" on messages_contact;
create policy "Permettre l'envoi de messages de contact (connecté)"
on messages_contact
for insert
to authenticated
with check (true);
