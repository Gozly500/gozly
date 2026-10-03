-- ============================================================
-- Ajout : groupes de discussion + suppression de conversations.
--
-- - conversations.type accepte maintenant 'groupe' (en plus de 'equipe' et
--   'directe') : une conversation avec un nom (titre) et des participants
--   choisis (employés et gens du dashboard), créée depuis le dashboard.
-- - conversations.titre : le nom du groupe. cree_par : qui l'a créé.
-- - Un groupe se lit/écrit comme une conversation 'directe' : seulement par
--   ses participants (les policies sont élargies à 'groupe').
-- - Les gens du dashboard peuvent SUPPRIMER une conversation 'directe' ou
--   'groupe' dont ils font partie : elle disparaît entièrement (messages et
--   participants en cascade), chez tout le monde. Pour rediscuter, il faut
--   en créer une nouvelle. Le fil 'equipe' ne se supprime jamais.
--
-- Le nettoyage automatique des conversations orphelines (moins de 2
-- participants) ne touche que les 'directe', jamais les groupes.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table conversations add column if not exists titre text;
alter table conversations add column if not exists cree_par uuid references auth.users(id) on delete set null;

grant delete on conversations to authenticated;

-- conversations : lecture
drop policy if exists "Voir les conversations de son entreprise" on conversations;
create policy "Voir les conversations de son entreprise"
on conversations for select
to authenticated
using (
  (type = 'equipe' and est_membre(entreprise_id))
  or (type in ('directe', 'groupe') and est_participant_direct(id))
);

-- conversations : suppression (seulement 'directe' / 'groupe', par un participant)
drop policy if exists "Supprimer une conversation privee ou un groupe" on conversations;
create policy "Supprimer une conversation privee ou un groupe"
on conversations for delete
to authenticated
using (type in ('directe', 'groupe') and est_participant_direct(id));

-- participants : lecture
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
      or (c.type in ('directe', 'groupe') and est_participant_direct(c.id))
    )
  )
);

-- messages : lecture
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
      or (c.type in ('directe', 'groupe') and est_participant_direct(c.id))
    )
  )
);

-- messages : envoi
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
      or (c.type in ('directe', 'groupe') and est_participant_direct(c.id))
    )
  )
);
