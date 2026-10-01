-- ============================================================
-- Ajout : tâches "modèles" pré-enregistrées par catégorie (Planning).
-- Exemple Pasta : la catégorie "Pizzas" a un modèle par sorte de pizza
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
