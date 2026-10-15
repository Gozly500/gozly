-- ============================================================
-- Ajout : langue préférée du compte (Paramètres du compte > Apparence > Langue).
-- 'fr' ou 'en' ; NULL = pas de préférence enregistrée (le site utilise alors le
-- cookie de langue / la langue du navigateur).
--
-- Les GRANT/policy UPDATE sur profils existent déjà (parametres_compte.sql),
-- donc aucune permission supplémentaire n'est nécessaire.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table profils add column if not exists langue text check (langue in ('fr', 'en'));
