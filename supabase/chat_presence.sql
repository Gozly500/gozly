-- ============================================================
-- Discussion : "en train d'écrire…" et "Vu".
-- Une ligne par personne et par conversation : quand elle a écrit pour la
-- dernière fois (ecrit_at) et quand elle a regardé la conversation (lu_at).
-- Seules les routes serveur (service_role) y touchent.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists chat_presence (
  conversation_id uuid not null references conversations(id) on delete cascade,
  participant text not null, -- 'e:<id employé>' ou 'u:<id utilisateur>'
  nom text not null default '',
  ecrit_at timestamptz,
  lu_at timestamptz,
  primary key (conversation_id, participant)
);

alter table chat_presence enable row level security;
grant all on chat_presence to service_role;
