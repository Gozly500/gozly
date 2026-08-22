-- ============================================================
-- Ajout : système de communication - un fil d'équipe (tout le monde
-- de l'entreprise, employés + admins) et des messages privés entre
-- deux personnes. Les employés et les gens du dashboard sont deux
-- systèmes d'identité différents (voir lib/employeSession.js) - une
-- conversation/message appartient soit à un employe_id, soit à un
-- user_id (auth.users), jamais les deux.
--
-- Les employés n'ont pas de rôle Postgres dédié : leur accès passe
-- entièrement par les routes /api/employe-app/chat/* (service_role,
-- déjà couvert par service_role_grants.sql). Les policies ci-dessous
-- ne concernent que l'accès direct du dashboard (authenticated).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  type text not null, -- 'equipe' | 'directe'
  created_at timestamptz not null default now()
);

create unique index if not exists conversations_equipe_unique on conversations (entreprise_id) where type = 'equipe';

-- Seulement pour les conversations 'directe' (le fil 'equipe' est
-- implicite : tout membre de l'entreprise, employé ou admin, y a accès
-- sans ligne ici).
create table if not exists conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  employe_id uuid references employes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  check ((employe_id is not null) <> (user_id is not null))
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  employe_id uuid references employes(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  contenu text not null,
  created_at timestamptz not null default now(),
  check ((employe_id is not null) <> (user_id is not null))
);

create index if not exists messages_conversation_created on messages (conversation_id, created_at);

alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;

grant select, insert on conversations to authenticated;
grant select, insert on conversation_participants to authenticated;
grant select, insert on messages to authenticated;

-- conversations
drop policy if exists "Voir les conversations de son entreprise" on conversations;
create policy "Voir les conversations de son entreprise"
on conversations for select
to authenticated
using (
  (type = 'equipe' and est_membre(entreprise_id))
  or (type = 'directe' and exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
  ))
);

drop policy if exists "Creer une conversation pour son entreprise" on conversations;
create policy "Creer une conversation pour son entreprise"
on conversations for insert
to authenticated
with check (est_membre(entreprise_id));

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
      or (c.type = 'directe' and exists (
        select 1 from conversation_participants cp2
        where cp2.conversation_id = c.id and cp2.user_id = auth.uid()
      ))
    )
  )
);

drop policy if exists "Ajouter des participants a une conversation de son entreprise" on conversation_participants;
create policy "Ajouter des participants a une conversation de son entreprise"
on conversation_participants for insert
to authenticated
with check (
  exists (select 1 from conversations c where c.id = conversation_participants.conversation_id and est_membre(c.entreprise_id))
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
      or (c.type = 'directe' and exists (
        select 1 from conversation_participants cp
        where cp.conversation_id = c.id and cp.user_id = auth.uid()
      ))
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
      or (c.type = 'directe' and exists (
        select 1 from conversation_participants cp
        where cp.conversation_id = c.id and cp.user_id = auth.uid()
      ))
    )
  )
);
