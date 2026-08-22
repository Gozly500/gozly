-- ============================================================
-- Correctif : quand un employé (ou un admin) est retiré d'une
-- conversation privée (ex: employé supprimé - cascade sur
-- conversation_participants), l'AUTRE personne se retrouvait avec un
-- fil "directe" orphelin dans sa liste (plus qu'un seul participant,
-- donc plus personne en face), affiché juste "Conversation" au lieu
-- d'être nettoyé. Une conversation "directe" n'a de sens qu'à deux -
-- si elle tombe à moins de deux participants, on la supprime
-- entièrement (ce qui supprime aussi ses messages en cascade).
--
-- Ne touche jamais le fil "equipe" (sa participation est implicite,
-- pas suivie via conversation_participants).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function nettoyer_conversation_directe_orpheline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from conversations
  where id = old.conversation_id
  and type = 'directe'
  and (select count(*) from conversation_participants where conversation_id = old.conversation_id) < 2;

  return old;
end;
$$;

drop trigger if exists trg_nettoyer_conversation_directe on conversation_participants;
create trigger trg_nettoyer_conversation_directe
after delete on conversation_participants
for each row
execute function nettoyer_conversation_directe_orpheline();
