-- ============================================================
-- Correctif : "infinite recursion detected in policy for relation
-- conversation_participants". La policy de conversation_participants
-- vérifiait l'accès en interrogeant... conversation_participants,
-- ce qui redéclenche la même policy en boucle. Même piège que celui
-- déjà évité pour "membres" avec est_membre() (voir equipe.sql) -
-- une fonction security definer contourne les RLS pour cette
-- vérification précise, ce qui casse la boucle.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- (après chat.sql)
-- ============================================================

create or replace function est_participant_direct(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  );
$$;

grant execute on function est_participant_direct(uuid) to authenticated;

-- conversations
drop policy if exists "Voir les conversations de son entreprise" on conversations;
create policy "Voir les conversations de son entreprise"
on conversations for select
to authenticated
using (
  (type = 'equipe' and est_membre(entreprise_id))
  or (type = 'directe' and est_participant_direct(id))
);

-- conversation_participants
drop policy if exists "Voir les participants de ses conversations" on conversation_participants;
create policy "Voir les participants de ses conversations"
on conversation_participants for select
to authenticated
using (
  exists (
    select 1 from conversations c
    where c.id = conversation_participants.conversation_id
    and (
      (c.type = 'equipe' and est_membre(c.entreprise_id))
      or (c.type = 'directe' and est_participant_direct(c.id))
    )
  )
);

-- messages
drop policy if exists "Voir les messages des conversations accessibles" on messages;
create policy "Voir les messages des conversations accessibles"
on messages for select
to authenticated
using (
  exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
    and (
      (c.type = 'equipe' and est_membre(c.entreprise_id))
      or (c.type = 'directe' and est_participant_direct(c.id))
    )
  )
);

drop policy if exists "Envoyer un message dans une conversation accessible" on messages;
create policy "Envoyer un message dans une conversation accessible"
on messages for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
    and (
      (c.type = 'equipe' and est_membre(c.entreprise_id))
      or (c.type = 'directe' and est_participant_direct(c.id))
    )
  )
);
