-- ============================================================
-- Pop-ups d'ouverture : version anglaise (facultative) (à exécuter APRÈS popups_app.sql)
-- Les personnes dont l'app est en anglais voient titre_en / contenu_en / bouton_texte_en ;
-- si la version anglaise est vide, elles voient la française. Le lien du bouton est le même dans les deux langues.
-- Sûr à réexécuter.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table popups_app add column if not exists titre_en text;
alter table popups_app add column if not exists contenu_en text;
alter table popups_app add column if not exists bouton_texte_en text;
