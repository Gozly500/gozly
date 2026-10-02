-- ============================================================
-- Ajout : commandes saisies à la main dans le module Commandes en ligne
-- (téléphone, comptoir...). Elles vivent dans la même table que les
-- commandes Wix, avec source = 'manuel'. Les utilisateurs de l'entreprise
-- peuvent créer / modifier / supprimer SEULEMENT les commandes manuelles
-- (les commandes Wix restent en lecture seule, écrites par la synchro).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

grant insert, update, delete on commandes_en_ligne to authenticated;

drop policy if exists "Un utilisateur peut créer des commandes manuelles" on commandes_en_ligne;
create policy "Un utilisateur peut créer des commandes manuelles"
on commandes_en_ligne for insert to authenticated
with check (source = 'manuel' and est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut modifier ses commandes manuelles" on commandes_en_ligne;
create policy "Un utilisateur peut modifier ses commandes manuelles"
on commandes_en_ligne for update to authenticated
using (source = 'manuel' and est_membre(entreprise_id))
with check (source = 'manuel' and est_membre(entreprise_id));

drop policy if exists "Un utilisateur peut supprimer ses commandes manuelles" on commandes_en_ligne;
create policy "Un utilisateur peut supprimer ses commandes manuelles"
on commandes_en_ligne for delete to authenticated
using (source = 'manuel' and est_membre(entreprise_id));
