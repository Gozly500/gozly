-- ============================================================
-- Ajout : système d'équipe (plusieurs comptes par entreprise)
-- Remplace la relation stricte "1 profil = 1 entreprise" par un système
-- d'adhésion multiple (membres), avec invitations.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- 1. Table des adhésions (qui a accès à quelle entreprise).
create table if not exists membres (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'membre',
  created_at timestamptz not null default now(),
  unique (entreprise_id, user_id)
);

alter table membres enable row level security;
grant select, insert, update, delete on membres to authenticated;

-- Fonctions security definer (même piège de récursion infinie RLS que
-- pour "admins" - on le contourne dès le départ ici).
create or replace function est_membre(p_entreprise_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from membres
    where entreprise_id = p_entreprise_id and user_id = auth.uid()
  );
$$;

grant execute on function est_membre(uuid) to authenticated;

create or replace function mes_entreprises()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select entreprise_id from membres where user_id = auth.uid();
$$;

grant execute on function mes_entreprises() to authenticated;

drop policy if exists "Un membre peut voir les autres membres de son entreprise" on membres;
create policy "Un membre peut voir les autres membres de son entreprise"
on membres for select
to authenticated
using (est_membre(entreprise_id));

drop policy if exists "Un membre peut retirer un autre membre de son entreprise" on membres;
create policy "Un membre peut retirer un autre membre de son entreprise"
on membres for delete
to authenticated
using (est_membre(entreprise_id));

-- Un utilisateur peut toujours s'ajouter LUI-MÊME comme membre (ex: à la
-- création de sa propre entreprise, il devient son premier "propriétaire").
-- Ajouter quelqu'un D'AUTRE ne peut se faire que via accepter_invitation().
drop policy if exists "Un utilisateur peut s'ajouter lui-même comme membre" on membres;
create policy "Un utilisateur peut s'ajouter lui-même comme membre"
on membres for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Les admins peuvent tout faire sur membres" on membres;
create policy "Les admins peuvent tout faire sur membres"
on membres for all
to authenticated
using (is_admin())
with check (is_admin());

-- 2. Migration : chaque profil existant devient "propriétaire" de son
-- entreprise actuelle, pour ne perdre l'accès de personne.
insert into membres (entreprise_id, user_id, role)
select entreprise_id, id, 'proprietaire'
from profils
where entreprise_id is not null
on conflict (entreprise_id, user_id) do nothing;

-- 3. profils.entreprise_id n'est plus la source de vérité (remplacée par
-- membres) - rendue optionnelle plutôt que supprimée, pour ne rien casser.
alter table profils alter column entreprise_id drop not null;

-- 4. Invitations.
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  email text not null,
  statut text not null default 'en_attente' check (statut in ('en_attente','acceptee','refusee')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table invitations enable row level security;
grant select, insert, update, delete on invitations to authenticated;

drop policy if exists "Un membre peut voir les invitations de son entreprise" on invitations;
create policy "Un membre peut voir les invitations de son entreprise"
on invitations for select
to authenticated
using (est_membre(entreprise_id) or email = auth.jwt() ->> 'email');

drop policy if exists "Un membre peut inviter dans son entreprise" on invitations;
create policy "Un membre peut inviter dans son entreprise"
on invitations for insert
to authenticated
with check (est_membre(entreprise_id));

drop policy if exists "Un membre peut annuler une invitation de son entreprise" on invitations;
create policy "Un membre peut annuler une invitation de son entreprise"
on invitations for delete
to authenticated
using (est_membre(entreprise_id));

drop policy if exists "Un invité peut répondre à son invitation" on invitations;
create policy "Un invité peut répondre à son invitation"
on invitations for update
to authenticated
using (email = auth.jwt() ->> 'email')
with check (email = auth.jwt() ->> 'email');

drop policy if exists "Les admins peuvent tout faire sur invitations" on invitations;
create policy "Les admins peuvent tout faire sur invitations"
on invitations for all
to authenticated
using (is_admin())
with check (is_admin());

-- 5. Accepter une invitation = créer le membership + marquer l'invitation
-- acceptée, de façon atomique. security definer car un utilisateur ne
-- peut pas insérer dans "membres" lui-même directement (la seule voie
-- d'entrée légitime est d'accepter une invitation).
create or replace function accepter_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_entreprise_id uuid;
begin
  select email, entreprise_id into v_email, v_entreprise_id
  from invitations
  where id = p_invitation_id and statut = 'en_attente';

  if v_email is null then
    raise exception 'Invitation introuvable ou déjà traitée.';
  end if;

  if v_email <> (auth.jwt() ->> 'email') then
    raise exception 'Cette invitation ne t''est pas destinée.';
  end if;

  insert into membres (entreprise_id, user_id, role)
  values (v_entreprise_id, auth.uid(), 'membre')
  on conflict (entreprise_id, user_id) do nothing;

  update invitations set statut = 'acceptee' where id = p_invitation_id;
end;
$$;

grant execute on function accepter_invitation(uuid) to authenticated;

-- ============================================================
-- 6. Toutes les policies existantes basées sur "profils.entreprise_id"
-- deviennent basées sur "est_membre()" - un utilisateur peut avoir accès
-- à plusieurs entreprises maintenant.
-- ============================================================

-- entreprises
drop policy if exists "Un utilisateur peut lire sa propre entreprise" on entreprises;
create policy "Un utilisateur peut lire sa propre entreprise"
on entreprises for select
to authenticated
using (est_membre(id));

drop policy if exists "Un utilisateur peut modifier sa propre entreprise" on entreprises;
create policy "Un utilisateur peut modifier sa propre entreprise"
on entreprises for update
to authenticated
using (est_membre(id))
with check (est_membre(id));

-- employes
drop policy if exists "Un utilisateur peut lire les employés de son entreprise" on employes;
create policy "Un utilisateur peut lire les employés de son entreprise"
on employes for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut ajouter des employés à son entreprise" on employes;
create policy "Un utilisateur peut ajouter des employés à son entreprise"
on employes for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier les employés de son entreprise" on employes;
create policy "Un utilisateur peut modifier les employés de son entreprise"
on employes for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer les employés de son entreprise" on employes;
create policy "Un utilisateur peut supprimer les employés de son entreprise"
on employes for delete to authenticated using (est_membre(entreprise_id));

-- categories
drop policy if exists "Un utilisateur peut lire ses catégories" on categories;
create policy "Un utilisateur peut lire ses catégories"
on categories for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut créer ses catégories" on categories;
create policy "Un utilisateur peut créer ses catégories"
on categories for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier ses catégories" on categories;
create policy "Un utilisateur peut modifier ses catégories"
on categories for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer ses catégories" on categories;
create policy "Un utilisateur peut supprimer ses catégories"
on categories for delete to authenticated using (est_membre(entreprise_id));

-- taches
drop policy if exists "Un utilisateur peut lire ses tâches" on taches;
create policy "Un utilisateur peut lire ses tâches"
on taches for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut créer ses tâches" on taches;
create policy "Un utilisateur peut créer ses tâches"
on taches for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier ses tâches" on taches;
create policy "Un utilisateur peut modifier ses tâches"
on taches for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer ses tâches" on taches;
create policy "Un utilisateur peut supprimer ses tâches"
on taches for delete to authenticated using (est_membre(entreprise_id));

-- planning_quarts
drop policy if exists "Un utilisateur peut lire les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut lire les quarts de son entreprise"
on planning_quarts for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut ajouter des quarts à son entreprise" on planning_quarts;
create policy "Un utilisateur peut ajouter des quarts à son entreprise"
on planning_quarts for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut modifier les quarts de son entreprise"
on planning_quarts for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut supprimer les quarts de son entreprise"
on planning_quarts for delete to authenticated using (est_membre(entreprise_id));

-- pointages
drop policy if exists "Un utilisateur peut lire les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut lire les pointages de son entreprise"
on pointages for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut ajouter des pointages à son entreprise" on pointages;
create policy "Un utilisateur peut ajouter des pointages à son entreprise"
on pointages for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut modifier les pointages de son entreprise"
on pointages for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut supprimer les pointages de son entreprise"
on pointages for delete to authenticated using (est_membre(entreprise_id));

-- modules_actifs
drop policy if exists "Un utilisateur peut lire les modules de son entreprise" on modules_actifs;
create policy "Un utilisateur peut lire les modules de son entreprise"
on modules_actifs for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut activer un module pour son entreprise" on modules_actifs;
create policy "Un utilisateur peut activer un module pour son entreprise"
on modules_actifs for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut désactiver un module de son entreprise" on modules_actifs;
create policy "Un utilisateur peut désactiver un module de son entreprise"
on modules_actifs for delete to authenticated using (est_membre(entreprise_id));
