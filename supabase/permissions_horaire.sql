-- ============================================================
-- Permissions restreintes pour le module Horaire & Pointage
-- (Planning + Feuille de temps), avec approbation par semaine.
-- Voir le plan pour le contexte complet.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- 1. Table des permissions accordées à un membre (générique - pas
-- spécifique à Horaire, voir lib/permissions.js pour la liste actuelle).
-- emplacement_id = null veut dire "toutes les succursales" (ou "l'entreprise
-- n'a pas de succursales configurées").
create table if not exists membre_permissions (
  id uuid primary key default gen_random_uuid(),
  membre_id uuid not null references membres(id) on delete cascade,
  permission text not null,
  emplacement_id uuid references emplacements(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (membre_id, permission, emplacement_id)
);

alter table membre_permissions enable row level security;
grant select, insert, update, delete on membre_permissions to authenticated;
grant select on membre_permissions to service_role;

-- 2. Semaines de feuille de temps approuvées par le propriétaire.
create table if not exists feuille_temps_semaines (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  emplacement_id uuid references emplacements(id) on delete cascade,
  semaine_debut date not null,
  approuve_par uuid references auth.users(id),
  approuve_le timestamptz not null default now(),
  unique (entreprise_id, semaine_debut, emplacement_id)
);

alter table feuille_temps_semaines enable row level security;
grant select, insert, delete on feuille_temps_semaines to authenticated;
grant select on feuille_temps_semaines to service_role;

-- 3. Mode "visible sans approbation" par entreprise (Personnalisation).
alter table entreprises add column if not exists feuille_temps_visible_sans_approbation boolean not null default false;

-- 4. Fonction générique de vérification de permission - un propriétaire a
-- toujours accès complet, sans passer par membre_permissions (même logique
-- que est_proprietaire()/is_admin() déjà dans le code).
create or replace function a_permission(p_entreprise_id uuid, p_permission text, p_emplacement_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select est_proprietaire(p_entreprise_id) or exists(
    select 1 from membre_permissions mp
    join membres m on m.id = mp.membre_id
    where m.entreprise_id = p_entreprise_id
      and m.user_id = auth.uid()
      and mp.permission = p_permission
      and (mp.emplacement_id is null or mp.emplacement_id = p_emplacement_id)
  );
$$;

grant execute on function a_permission(uuid, text, uuid) to authenticated;

-- Début de la semaine d'un pointage, selon le réglage lundi/dimanche de
-- l'entreprise (même calcul que getDebutSemaine() côté JS - lib/semaine.js).
create or replace function debut_semaine_pointage(p_entreprise_id uuid, p_entree timestamptz)
returns date
language sql
security definer
set search_path = public
stable
as $$
  select case
    when (select premier_jour_semaine from entreprises where id = p_entreprise_id) = 'dimanche'
      then (date_trunc('week', p_entree + interval '1 day') - interval '1 day')::date
    else date_trunc('week', p_entree)::date
  end;
$$;

grant execute on function debut_semaine_pointage(uuid, timestamptz) to authenticated;

-- 5. Migration : chaque membre non-propriétaire existant garde son accès
-- complet actuel - reçoit toutes les permissions, portée "toutes les
-- succursales" - le propriétaire peut ensuite resserrer chacun dans Équipe.
insert into membre_permissions (membre_id, permission, emplacement_id)
select m.id, p.permission, null
from membres m
cross join (values
  ('voir_feuille_temps'),
  ('gerer_feuille_temps'),
  ('approuver_feuille_temps'),
  ('gerer_horaire')
) as p(permission)
where m.role <> 'proprietaire'
on conflict (membre_id, permission, emplacement_id) do nothing;

-- ============================================================
-- 6. Policies : membre_permissions
-- ============================================================

drop policy if exists "Un membre peut voir ses propres permissions" on membre_permissions;
create policy "Un membre peut voir ses propres permissions"
on membre_permissions for select
to authenticated
using (
  membre_id in (select id from membres where user_id = auth.uid())
  or est_proprietaire((select entreprise_id from membres where id = membre_permissions.membre_id))
);

drop policy if exists "Un propriétaire peut gérer les permissions de son entreprise" on membre_permissions;
create policy "Un propriétaire peut gérer les permissions de son entreprise"
on membre_permissions for all
to authenticated
using (est_proprietaire((select entreprise_id from membres where id = membre_permissions.membre_id)))
with check (est_proprietaire((select entreprise_id from membres where id = membre_permissions.membre_id)));

drop policy if exists "Les admins peuvent tout faire sur membre_permissions" on membre_permissions;
create policy "Les admins peuvent tout faire sur membre_permissions"
on membre_permissions for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- 7. Policies : feuille_temps_semaines
-- ============================================================

drop policy if exists "Voir les semaines si on a une permission Horaire" on feuille_temps_semaines;
create policy "Voir les semaines si on a une permission Horaire"
on feuille_temps_semaines for select
to authenticated
using (
  a_permission(entreprise_id, 'voir_feuille_temps', emplacement_id)
  or a_permission(entreprise_id, 'gerer_feuille_temps', emplacement_id)
  or a_permission(entreprise_id, 'approuver_feuille_temps', emplacement_id)
);

drop policy if exists "Approuver une semaine" on feuille_temps_semaines;
create policy "Approuver une semaine"
on feuille_temps_semaines for insert
to authenticated
with check (a_permission(entreprise_id, 'approuver_feuille_temps', emplacement_id));

drop policy if exists "Désapprouver une semaine" on feuille_temps_semaines;
create policy "Désapprouver une semaine"
on feuille_temps_semaines for delete
to authenticated
using (a_permission(entreprise_id, 'approuver_feuille_temps', emplacement_id));

drop policy if exists "Les admins peuvent tout faire sur feuille_temps_semaines" on feuille_temps_semaines;
create policy "Les admins peuvent tout faire sur feuille_temps_semaines"
on feuille_temps_semaines for all
to authenticated
using (is_admin())
with check (is_admin());

-- ============================================================
-- 8. Policies : planning_quarts - remplace est_membre() par a_permission()
-- ============================================================

drop policy if exists "Un utilisateur peut lire les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut lire les quarts de son entreprise"
on planning_quarts for select to authenticated
using (a_permission(entreprise_id, 'gerer_horaire', emplacement_id));

drop policy if exists "Un utilisateur peut ajouter des quarts à son entreprise" on planning_quarts;
create policy "Un utilisateur peut ajouter des quarts à son entreprise"
on planning_quarts for insert to authenticated
with check (a_permission(entreprise_id, 'gerer_horaire', emplacement_id));

drop policy if exists "Un utilisateur peut modifier les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut modifier les quarts de son entreprise"
on planning_quarts for update to authenticated
using (a_permission(entreprise_id, 'gerer_horaire', emplacement_id))
with check (a_permission(entreprise_id, 'gerer_horaire', emplacement_id));

drop policy if exists "Un utilisateur peut supprimer les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut supprimer les quarts de son entreprise"
on planning_quarts for delete to authenticated
using (a_permission(entreprise_id, 'gerer_horaire', emplacement_id));

-- ============================================================
-- 9. Policies : pointages - lecture selon approbation, écriture selon
-- gerer_feuille_temps
-- ============================================================

drop policy if exists "Un utilisateur peut lire les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut lire les pointages de son entreprise"
on pointages for select to authenticated
using (
  a_permission(entreprise_id, 'gerer_feuille_temps', emplacement_id)
  or a_permission(entreprise_id, 'approuver_feuille_temps', emplacement_id)
  or (
    a_permission(entreprise_id, 'voir_feuille_temps', emplacement_id)
    and (
      (select feuille_temps_visible_sans_approbation from entreprises where id = pointages.entreprise_id)
      or exists (
        select 1 from feuille_temps_semaines s
        where s.entreprise_id = pointages.entreprise_id
          and s.semaine_debut = debut_semaine_pointage(pointages.entreprise_id, pointages.entree)
          and (s.emplacement_id is null or s.emplacement_id = pointages.emplacement_id)
      )
    )
  )
);

drop policy if exists "Un utilisateur peut ajouter des pointages à son entreprise" on pointages;
create policy "Un utilisateur peut ajouter des pointages à son entreprise"
on pointages for insert to authenticated
with check (a_permission(entreprise_id, 'gerer_feuille_temps', emplacement_id));

drop policy if exists "Un utilisateur peut modifier les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut modifier les pointages de son entreprise"
on pointages for update to authenticated
using (a_permission(entreprise_id, 'gerer_feuille_temps', emplacement_id))
with check (a_permission(entreprise_id, 'gerer_feuille_temps', emplacement_id));

drop policy if exists "Un utilisateur peut supprimer les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut supprimer les pointages de son entreprise"
on pointages for delete to authenticated
using (a_permission(entreprise_id, 'gerer_feuille_temps', emplacement_id));
