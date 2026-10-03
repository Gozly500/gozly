-- ============================================================
-- Ajout : horaires d'ouverture des succursales + fermeture automatique
-- des pointages oubliés.
--
-- - emplacements.horaires_ouverture : heures d'ouverture par jour de la
--   semaine, ex: {"1": {"debut": "09:00", "fin": "21:00"}, "2": {...}}
--   (clé = numéro du jour : 0 = dimanche ... 6 = samedi ; jour absent =
--   fermé). NULL = pas d'horaire : aucune fermeture automatique.
-- - pointages.sortie_auto : vrai quand la sortie a été posée AUTOMATIQUEMENT
--   (employé qui a oublié de pointer son départ). La feuille de temps
--   affiche alors « oubli potentiel » ; corriger le pointage retire le drapeau.
--
-- Règle : un pointage encore ouvert 1 h 30 après la fermeture est fermé
-- automatiquement, avec l'heure de FERMETURE comme sortie (voir
-- lib/pointageAuto.js).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table emplacements add column if not exists horaires_ouverture jsonb;

alter table pointages add column if not exists sortie_auto boolean not null default false;

grant select, insert, update, delete on pointages to service_role;
grant select, update on emplacements to service_role;
