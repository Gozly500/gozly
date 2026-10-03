-- ============================================================
-- Discussion : réactions (👍 ❤️ 😂 ...) et réponse à un message précis.
--
-- - messages.reponse_a : le message auquel on répond (si ce message est
--   supprimé, la réponse reste, sans citation).
-- - message_reactions : une réaction par personne et par message (on peut
--   la changer ou la retirer).
-- Seules les routes serveur (service_role) touchent aux réactions.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table messages add column if not exists reponse_a uuid references messages(id) on delete set null;

create table if not exists message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  participant text not null, -- 'e:<id employé>' ou 'u:<id utilisateur>'
  nom text not null default '',
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, participant)
);

alter table message_reactions enable row level security;
grant all on message_reactions to service_role;
