-- ============================================================
-- Gestion des groupes de discussion (app employé) :
-- administrateurs de groupe, ajout / retrait de membres, quitter,
-- et messages « système » (« Marie a quitté le groupe », etc.).
--
-- - conversation_participants.est_admin : administrateur du groupe (peut retirer des
--   membres et nommer d'autres administrateurs). Le créateur l'est d'office.
-- - conversation_participants.ajoute_le : sert à choisir le prochain administrateur
--   quand le dernier quitte (le membre le plus ancien).
-- - messages.systeme : message d'information (quitté, ajouté, retiré, nommé admin)
--   affiché au centre du fil, jamais compté comme « non lu ».
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table conversation_participants add column if not exists est_admin boolean not null default false;
alter table conversation_participants add column if not exists ajoute_le timestamptz not null default now();
alter table messages add column if not exists systeme jsonb;
