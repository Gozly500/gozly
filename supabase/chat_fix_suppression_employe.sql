-- ============================================================
-- Correctif : supprimer un employé qui a déjà envoyé un message
-- échouait. messages.employe_id passe à NULL (ON DELETE SET NULL,
-- pour garder l'historique des conversations) mais la contrainte
-- exigeait qu'EXACTEMENT un des deux (employe_id/user_id) soit
-- renseigné - une fois employe_id mis à NULL, plus aucun des deux ne
-- l'était, ce qui violait la contrainte et bloquait la suppression.
--
-- Comportement voulu, maintenant correct :
-- - Retirer un employé retire son accès à ses conversations privées
--   (conversation_participants, toujours en cascade)
-- - Ses messages restent dans l'historique (fil équipe et DM), avec
--   l'expéditeur affiché comme "Employé supprimé"
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- Retire l'ancienne contrainte (nom généré automatiquement par
-- Postgres, recherché dynamiquement pour ne pas dépendre d'un nom
-- exact potentiellement différent).
do $$
declare
  ancien_nom text;
begin
  select conname into ancien_nom
  from pg_constraint
  where conrelid = 'messages'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) ilike '%employe_id%user_id%';

  if ancien_nom is not null then
    execute format('alter table messages drop constraint %I', ancien_nom);
  end if;
end $$;

alter table messages add constraint messages_employe_ou_user_check check (not (employe_id is not null and user_id is not null));
