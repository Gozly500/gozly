-- ============================================================
-- Correctif : la demande de site vitrine (bouton "Demander" dans
-- ModulesModal.jsx) insère dans messages_contact en tant qu'utilisateur
-- connecté (authenticated), mais la seule policy d'insertion existante
-- (policy_contact_form.sql) ne visait que le rôle "anon" (formulaire de
-- contact public). Résultat : la demande échouait toujours pour un
-- utilisateur du dashboard.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

grant insert on messages_contact to authenticated;

drop policy if exists "Les utilisateurs connectes peuvent envoyer un message" on messages_contact;
create policy "Les utilisateurs connectes peuvent envoyer un message"
on messages_contact for insert
to authenticated
with check (true);
