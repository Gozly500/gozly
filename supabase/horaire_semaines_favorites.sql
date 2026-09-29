-- ============================================================
-- Ajout : semaines "favorites" dans l'Horaire - une semaine qu'on veut
-- pouvoir réimporter comme modèle même si elle est plus vieille que la
-- fenêtre habituelle des 8 dernières semaines (voir HoraireSection.jsx).
-- Limite de 3 favoris (par entreprise + emplacement) appliquée côté client,
-- comme le reste des règles métier "souples" de ce fichier.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists horaire_semaines_favorites (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  emplacement_id uuid references emplacements(id) on delete cascade,
  semaine_debut date not null,
  created_at timestamptz not null default now(),
  unique (entreprise_id, emplacement_id, semaine_debut)
);

alter table horaire_semaines_favorites enable row level security;

grant select, insert, delete on horaire_semaines_favorites to authenticated;

drop policy if exists "Voir les semaines favorites de son entreprise" on horaire_semaines_favorites;
create policy "Voir les semaines favorites de son entreprise"
on horaire_semaines_favorites for select
to authenticated
using (est_membre(entreprise_id));

drop policy if exists "Ajouter une semaine favorite dans son entreprise" on horaire_semaines_favorites;
create policy "Ajouter une semaine favorite dans son entreprise"
on horaire_semaines_favorites for insert
to authenticated
with check (est_membre(entreprise_id));

drop policy if exists "Retirer une semaine favorite de son entreprise" on horaire_semaines_favorites;
create policy "Retirer une semaine favorite de son entreprise"
on horaire_semaines_favorites for delete
to authenticated
using (est_membre(entreprise_id));
