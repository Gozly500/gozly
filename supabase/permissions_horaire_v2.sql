-- ============================================================
-- Permissions Horaire v2 : renomme gerer_feuille_temps -> corriger_
-- feuille_temps, ajoute exporter_feuille_temps et approuver_demandes,
-- ajoute planning_quarts.publie (brouillon/publié).
-- À exécuter APRÈS supabase/permissions_horaire.sql, dans le SQL Editor.
-- ============================================================

-- 1. Renomme le droit déjà accordé - ne casse rien pour l'équipe actuelle.
update membre_permissions set permission = 'corriger_feuille_temps' where permission = 'gerer_feuille_temps';

-- 2. pointages : remplace gerer_feuille_temps par corriger_feuille_temps
-- dans les policies d'écriture, et ajoute exporter_feuille_temps dans la
-- policy de lecture (même règle d'approbation que voir_feuille_temps).
drop policy if exists "Un utilisateur peut lire les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut lire les pointages de son entreprise"
on pointages for select to authenticated
using (
  a_permission(entreprise_id, 'corriger_feuille_temps', emplacement_id)
  or a_permission(entreprise_id, 'approuver_feuille_temps', emplacement_id)
  or (
    (a_permission(entreprise_id, 'voir_feuille_temps', emplacement_id) or a_permission(entreprise_id, 'exporter_feuille_temps', emplacement_id))
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
with check (a_permission(entreprise_id, 'corriger_feuille_temps', emplacement_id));

drop policy if exists "Un utilisateur peut modifier les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut modifier les pointages de son entreprise"
on pointages for update to authenticated
using (a_permission(entreprise_id, 'corriger_feuille_temps', emplacement_id))
with check (a_permission(entreprise_id, 'corriger_feuille_temps', emplacement_id));

drop policy if exists "Un utilisateur peut supprimer les pointages de son entreprise" on pointages;
create policy "Un utilisateur peut supprimer les pointages de son entreprise"
on pointages for delete to authenticated
using (a_permission(entreprise_id, 'corriger_feuille_temps', emplacement_id));

-- 3. Fonction pour vérifier une permission scopée par succursale via les
-- succursales assignées à un EMPLOYÉ (employe_emplacements) plutôt que par
-- une colonne emplacement_id directe - utile pour les demandes de congé,
-- qui n'ont pas de succursale propre.
create or replace function a_permission_employe(p_entreprise_id uuid, p_permission text, p_employe_id uuid)
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
      and (
        mp.emplacement_id is null
        or mp.emplacement_id in (select emplacement_id from employe_emplacements where employe_id = p_employe_id)
      )
  );
$$;

grant execute on function a_permission_employe(uuid, text, uuid) to authenticated;

-- 4. demandes_conge / demandes_echange : seule l'action d'approuver
-- (UPDATE) est restreinte - la lecture reste ouverte à tout membre.
drop policy if exists "Modifier les demandes de congé de son entreprise" on demandes_conge;
create policy "Modifier les demandes de congé de son entreprise"
on demandes_conge for update
to authenticated
using (a_permission_employe(entreprise_id, 'approuver_demandes', employe_id))
with check (a_permission_employe(entreprise_id, 'approuver_demandes', employe_id));

drop policy if exists "Modifier les demandes d'échange de son entreprise" on demandes_echange;
create policy "Modifier les demandes d'échange de son entreprise"
on demandes_echange for update
to authenticated
using (a_permission(entreprise_id, 'approuver_demandes', (select emplacement_id from planning_quarts where id = demandes_echange.quart_id)))
with check (a_permission(entreprise_id, 'approuver_demandes', (select emplacement_id from planning_quarts where id = demandes_echange.quart_id)));

-- 5. Planning : statut brouillon/publié. Un quart créé reste invisible aux
-- employés (/moi) tant qu'il n'a pas été publié - voir app/api/employe-app/
-- horaire/route.js.
alter table planning_quarts add column if not exists publie boolean not null default false;
