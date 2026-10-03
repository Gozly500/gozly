-- ============================================================
-- Ajout : tâches "modèles" pré-enregistrées par catégorie (Planning).
-- Exemple : pour une pizzeria, la catégorie "Pizzas" a un modèle par sorte de pizza
-- (Margherita, Pepperoni, etc.) - en créant la journée, on voit la liste
-- déjà prête avec juste un champ texte à côté pour noter la quantité, au
-- lieu de retaper le nom de chaque pizza à la main chaque jour.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists taches_modeles (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  categorie_id uuid not null references categories(id) on delete cascade,
  nom text not null,
  created_at timestamptz not null default now()
);

alter table taches_modeles enable row level security;

grant select, insert, update, delete on taches_modeles to authenticated;

drop policy if exists "Voir les tâches modèles de son entreprise" on taches_modeles;
create policy "Voir les tâches modèles de son entreprise"
on taches_modeles for select
to authenticated
using (est_membre(entreprise_id));

drop policy if exists "Créer une tâche modèle dans son entreprise" on taches_modeles;
create policy "Créer une tâche modèle dans son entreprise"
on taches_modeles for insert
to authenticated
with check (est_membre(entreprise_id));

drop policy if exists "Modifier une tâche modèle de son entreprise" on taches_modeles;
create policy "Modifier une tâche modèle de son entreprise"
on taches_modeles for update
to authenticated
using (est_membre(entreprise_id))
with check (est_membre(entreprise_id));

drop policy if exists "Supprimer une tâche modèle de son entreprise" on taches_modeles;
create policy "Supprimer une tâche modèle de son entreprise"
on taches_modeles for delete
to authenticated
using (est_membre(entreprise_id));

-- Comme pour categories/taches (planning_taches.sql) : un admin qui visite
-- le dashboard d'un client via "Voir le dashboard" (impersonation) n'est
-- pas membre de cette entreprise dans la table membres, donc est_membre()
-- renvoie faux pour lui - cette policy lui donne quand même accès.
drop policy if exists "Les admins peuvent tout faire sur taches_modeles" on taches_modeles;
create policy "Les admins peuvent tout faire sur taches_modeles"
on taches_modeles for all
to authenticated
using (is_admin())
with check (is_admin());
