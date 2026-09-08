-- ============================================================
-- Ajout : onglet "Demandes" dans le panneau admin - permet de lire et
-- traiter les messages_contact (suppressions de compte, sites vitrine,
-- formulaire de contact) sans passer par Supabase directement.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table messages_contact add column if not exists traite boolean not null default false;

-- messages_contact n'avait jusqu'ici aucun GRANT pour authenticated
-- (seul insert était possible, via les policies existantes) - il en faut
-- un explicite pour que les admins puissent lire/marquer comme traité.
grant select, update on messages_contact to authenticated;

drop policy if exists "Les admins peuvent lire les messages de contact" on messages_contact;
create policy "Les admins peuvent lire les messages de contact"
on messages_contact for select
to authenticated
using (is_admin());

drop policy if exists "Les admins peuvent modifier les messages de contact" on messages_contact;
create policy "Les admins peuvent modifier les messages de contact"
on messages_contact for update
to authenticated
using (is_admin())
with check (is_admin());
