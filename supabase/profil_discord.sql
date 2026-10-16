-- ============================================================
-- Ajout : compte Discord lié au compte Gozly (salon "sidentifier" du serveur Discord).
-- On ne stocke QUE l'identifiant Discord (un nombre), rien d'autre.
-- Un identifiant Discord ne peut être lié qu'à un seul compte Gozly (unique).
--
-- L'écriture se fait uniquement côté serveur (clé service_role, routes /api/discord/lier),
-- jamais depuis le navigateur : une personne ne peut donc pas s'attribuer un identifiant
-- Discord au hasard.
--
-- Sûr à réexécuter (if not exists).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table profils add column if not exists discord_id text;

create unique index if not exists profils_discord_id_unique
  on profils (discord_id)
  where discord_id is not null;
