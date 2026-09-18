-- ============================================================
-- CORRECTIF DE SÉCURITÉ (priorité haute) : active RLS sur les tables
-- admins, entreprises et profils.
--
-- Ces trois tables ont des policies RLS déjà écrites (voir admin_panel.sql,
-- policy_inscription.sql, equipe.sql, parametres_compte.sql), mais AUCUN
-- fichier de ce dossier ne contient le "alter table ... enable row level
-- security" qui les active réellement. Sans RLS activé, les policies sont
-- ignorées et l'accès dépend uniquement des GRANT Postgres (ex:
-- "grant select, insert, delete on admins to authenticated;" dans
-- admin_panel.sql) - ce qui, si c'est bien le cas dans ton environnement,
-- permettrait à N'IMPORTE QUEL compte client connecté de s'insérer
-- lui-même dans la table "admins" et d'obtenir un accès complet au
-- panneau admin (supprimer des comptes clients, tout lire).
--
-- "enable row level security" est sans danger à exécuter même si c'est
-- déjà activé (aucune erreur, aucun changement) - à exécuter dans tous
-- les cas pour être certain.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table admins enable row level security;
alter table entreprises enable row level security;
alter table profils enable row level security;
