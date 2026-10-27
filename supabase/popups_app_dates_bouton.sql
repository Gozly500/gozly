-- ============================================================
-- Pop-ups d'ouverture : suite (à exécuter APRÈS popups_app.sql)
-- - debut_le / fin_le : période pendant laquelle le pop-up est montré (facultatif : vide = sans limite).
-- - bouton_texte / bouton_url : un bouton de lien facultatif (ex : « Voir les nouveautés »).
-- Sûr à réexécuter.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table popups_app add column if not exists debut_le timestamptz;
alter table popups_app add column if not exists fin_le timestamptz;
alter table popups_app add column if not exists bouton_texte text;
alter table popups_app add column if not exists bouton_url text;
