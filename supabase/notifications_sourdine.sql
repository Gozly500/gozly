-- ============================================================
-- Sourdine et heures calmes (app employé) :
--  - conversations_sourdine : l'employé met une conversation (ou le fil Équipe) en sourdine -> plus de
--    notification de ses nouveaux messages (la conversation reste dans la liste) ;
--  - employes.heures_calmes_* : plage d'heures sans AUCUNE notification (ex. 22 h -> 7 h), réglée par
--    l'employé dans Paramètres > Notifications. Peut passer minuit.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists conversations_sourdine (
  employe_id uuid not null references employes(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  primary key (employe_id, conversation_id)
);

alter table conversations_sourdine enable row level security;
grant select, insert, update, delete on conversations_sourdine to service_role;

alter table employes add column if not exists heures_calmes_actif boolean not null default false;
alter table employes add column if not exists heures_calmes_debut time not null default '22:00';
alter table employes add column if not exists heures_calmes_fin time not null default '07:00';
