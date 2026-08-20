-- ============================================================
-- Ajout : module Planning (employés + horaire hebdomadaire)
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table employes enable row level security;
alter table planning_quarts enable row level security;

grant select, insert, update, delete on employes to authenticated;
grant select, insert, update, delete on planning_quarts to authenticated;

-- Employés : un utilisateur ne voit/modifie que les employés de SA PROPRE
-- entreprise.
drop policy if exists "Un utilisateur peut lire les employés de son entreprise" on employes;
create policy "Un utilisateur peut lire les employés de son entreprise"
on employes for select
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut ajouter des employés à son entreprise" on employes;
create policy "Un utilisateur peut ajouter des employés à son entreprise"
on employes for insert
to authenticated
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut modifier les employés de son entreprise" on employes;
create policy "Un utilisateur peut modifier les employés de son entreprise"
on employes for update
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()))
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut supprimer les employés de son entreprise" on employes;
create policy "Un utilisateur peut supprimer les employés de son entreprise"
on employes for delete
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

-- Admins : accès à tous les employés (support/dépannage).
drop policy if exists "Les admins peuvent tout faire sur employes" on employes;
create policy "Les admins peuvent tout faire sur employes"
on employes for all
to authenticated
using (is_admin())
with check (is_admin());

-- Quarts de travail : même principe, scellé à l'entreprise.
drop policy if exists "Un utilisateur peut lire les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut lire les quarts de son entreprise"
on planning_quarts for select
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut ajouter des quarts à son entreprise" on planning_quarts;
create policy "Un utilisateur peut ajouter des quarts à son entreprise"
on planning_quarts for insert
to authenticated
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut modifier les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut modifier les quarts de son entreprise"
on planning_quarts for update
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()))
with check (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Un utilisateur peut supprimer les quarts de son entreprise" on planning_quarts;
create policy "Un utilisateur peut supprimer les quarts de son entreprise"
on planning_quarts for delete
to authenticated
using (entreprise_id in (select entreprise_id from profils where profils.id = auth.uid()));

drop policy if exists "Les admins peuvent tout faire sur planning_quarts" on planning_quarts;
create policy "Les admins peuvent tout faire sur planning_quarts"
on planning_quarts for all
to authenticated
using (is_admin())
with check (is_admin());
