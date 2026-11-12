-- Fiches d'apps des développeurs. Le développeur facture lui-même (Gozly ne touche à aucun argent) : « prix » est informatif.
-- Sans propriétaire = proprietaire_id vide (compte supprimé). Une app approuvée modifiée repasse en « soumise ».
create table if not exists apps_developpeur (
  id uuid primary key default gen_random_uuid(),
  proprietaire_id uuid references profils(id) on delete set null,
  nom text not null,
  description_courte text not null,
  description_longue text,
  icone text,
  categorie text not null default 'ventes',
  url_service text not null,
  url_retour text not null,
  permissions text[] not null default '{}',
  courriel_support text not null,
  url_confidentialite text not null,
  payant boolean not null default false,
  prix text,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'soumise', 'approuvee', 'refusee')),
  note_refus text,
  accord_orpheline_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table apps_developpeur enable row level security;

-- Un développeur approuvé (voir demandes_developpeur) voit et gère SES apps.
drop policy if exists "Lire mes apps" on apps_developpeur;
create policy "Lire mes apps" on apps_developpeur for select to authenticated
using (proprietaire_id = auth.uid());

drop policy if exists "Créer mes apps" on apps_developpeur;
create policy "Créer mes apps" on apps_developpeur for insert to authenticated
with check (
  proprietaire_id = auth.uid()
  and statut in ('brouillon', 'soumise')
  and exists (select 1 from demandes_developpeur d where d.profil_id = auth.uid() and d.statut = 'approuvee')
);

-- Jamais « approuvee » ou « refusee » par le développeur : seul l'admin décide.
drop policy if exists "Modifier mes apps" on apps_developpeur;
create policy "Modifier mes apps" on apps_developpeur for update to authenticated
using (proprietaire_id = auth.uid())
with check (
  proprietaire_id = auth.uid()
  and statut in ('brouillon', 'soumise')
  and exists (select 1 from demandes_developpeur d where d.profil_id = auth.uid() and d.statut = 'approuvee')
);

-- Suppression permise seulement tant que l'app n'est pas approuvée.
drop policy if exists "Supprimer mes apps" on apps_developpeur;
create policy "Supprimer mes apps" on apps_developpeur for delete to authenticated
using (proprietaire_id = auth.uid() and statut <> 'approuvee');

grant select, insert, update, delete on apps_developpeur to authenticated;
grant all on apps_developpeur to service_role;
