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
  -- Supprimer un employé supprime aussi ses messages (pas de trace
  -- orpheline conservée indéfiniment - même logique que pointages.employe_id).
  employe_id uuid references employes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  contenu text not null,
  created_at timestamptz not null default now(),
  -- "au plus un des deux" plutôt que "exactement un" : couvre le cas
  -- (rare) où le compte auth.users d'un admin est supprimé, auquel cas
  -- user_id passe à NULL via ON DELETE SET NULL ci-dessus.
  constraint messages_employe_ou_user_check check (not (employe_id is not null and user_id is not null))
);

create index if not exists messages_conversation_created on messages (conversation_id, created_at);

-- Une conversation "directe" n'a de sens qu'à deux - si un participant en
-- est retiré (ex: employé supprimé) et qu'il en reste moins de deux, la
-- conversation entière (et ses messages) est nettoyée plutôt que de
-- laisser un fil orphelin affiché "Conversation" chez l'autre personne.
-- Ne touche jamais le fil "equipe" (participation implicite).
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

alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;

grant select, insert on conversations to authenticated;
grant select, insert on conversation_participants to authenticated;
grant select, insert on messages to authenticated;

-- Vérifie "auth.uid() participe à cette conversation" sans repasser par les
-- RLS de conversation_participants (security definer = contourne les RLS,
-- même technique que est_membre() dans equipe.sql) - une policy qui
-- interrogerait conversation_participants directement se redéclencherait
-- elle-même en boucle infinie.
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
      or (c.type = 'directe' and est_participant_direct(c.id))
    )
  )
);

-- Résout l'entreprise d'une conversation sans passer par les RLS de
-- "conversations" (security definer) : une conversation "directe" toute
-- neuve n'a encore aucun participant, donc sa propre policy de lecture
-- la cacherait sinon et bloquerait l'ajout du tout premier participant.
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
