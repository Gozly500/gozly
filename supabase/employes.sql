-- ============================================================
-- Ajout : base de données Employés (section "Entreprise", partagée
-- par tous les futurs modules qui en ont besoin - pas liée à un
-- module en particulier)
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table employes enable row level security;

grant select, insert, update, delete on employes to authenticated;

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

drop policy if exists "Les admins peuvent tout faire sur employes" on employes;
create policy "Les admins peuvent tout faire sur employes"
on employes for all
to authenticated
using (is_admin())
with check (is_admin());
