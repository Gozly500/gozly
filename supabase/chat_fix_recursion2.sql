-- ============================================================
-- Correctif : "new row violates row-level security policy for table
-- conversation_participants". La policy d'insertion relit
-- "conversations" pour vérifier l'entreprise - mais une conversation
-- "directe" toute neuve n'a encore aucun participant, donc la policy
-- de lecture de "conversations" la cache (est_participant_direct est
-- encore faux), et la vérification échoue avant même que le premier
-- participant soit ajouté. Même famille de piège que
-- chat_fix_recursion.sql, une étape plus loin.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- (après chat_fix_recursion.sql)
-- ============================================================

create or replace function entreprise_de_conversation(p_conversation_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select entreprise_id from conversations where id = p_conversation_id;
$$;

grant execute on function entreprise_de_conversation(uuid) to authenticated;

drop policy if exists "Ajouter des participants a une conversation de son entreprise" on conversation_participants;
create policy "Ajouter des participants a une conversation de son entreprise"
on conversation_participants for insert
to authenticated
with check (est_membre(entreprise_de_conversation(conversation_id)));
