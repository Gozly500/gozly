-- ============================================================
-- Ajout : suivi de lecture des conversations (pour la cloche de
-- notifications côté dashboard admin). Scope volontairement réduit à
-- user_id (authenticated) - l'app employé (/moi) n'est pas concernée
-- pour l'instant.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists conversation_lectures (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dernier_lu_a timestamptz not null default now(),
  unique (conversation_id, user_id)
);

alter table conversation_lectures enable row level security;
grant select, insert, update on conversation_lectures to authenticated;

drop policy if exists "Un utilisateur peut lire ses propres lectures" on conversation_lectures;
create policy "Un utilisateur peut lire ses propres lectures"
on conversation_lectures for select to authenticated using (user_id = auth.uid());

drop policy if exists "Un utilisateur peut marquer ses propres lectures" on conversation_lectures;
create policy "Un utilisateur peut marquer ses propres lectures"
on conversation_lectures for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Un utilisateur peut mettre à jour ses propres lectures" on conversation_lectures;
create policy "Un utilisateur peut mettre à jour ses propres lectures"
on conversation_lectures for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Les admins peuvent tout faire sur conversation_lectures" on conversation_lectures;
create policy "Les admins peuvent tout faire sur conversation_lectures"
on conversation_lectures for all to authenticated using (is_admin()) with check (is_admin());

-- Backfill : marque tout comme "déjà lu maintenant" pour les membres
-- actuels, pour ne pas transformer tout l'historique de chat en
-- messages non lus au premier chargement après cette migration.
insert into conversation_lectures (conversation_id, user_id, dernier_lu_a)
select c.id, m.user_id, now()
from conversations c
join membres m on m.entreprise_id = c.entreprise_id
where c.type = 'equipe'
on conflict (conversation_id, user_id) do nothing;

insert into conversation_lectures (conversation_id, user_id, dernier_lu_a)
select cp.conversation_id, cp.user_id, now()
from conversation_participants cp
where cp.user_id is not null
on conflict (conversation_id, user_id) do nothing;
