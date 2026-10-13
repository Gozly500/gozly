-- ============================================================
-- Supprimer une conversation « pour moi » (app employé) : elle disparaît de la liste de l'employé avec ses
-- messages, de SON côté seulement - l'autre personne et le propriétaire gardent tout (important : un
-- employé ne peut pas effacer des preuves en cas de harcèlement). Si quelqu'un écrit de nouveau, la
-- conversation réapparaît, avec seulement les messages venus après la suppression.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists conversations_masquees (
  employe_id uuid not null references employes(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  masque_le timestamptz not null default now(),
  primary key (employe_id, conversation_id)
);

alter table conversations_masquees enable row level security;
grant select, insert, update, delete on conversations_masquees to service_role;
