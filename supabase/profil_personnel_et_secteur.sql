-- ============================================================
-- Sépare les informations PERSONNELLES (compte) des informations
-- D'ENTREPRISE : le compte a maintenant un prénom, un nom de famille et une
-- photo de profil à lui ; le nom, le logo, l'adresse, le secteur
-- d'activité et les contacts restent sur l'entreprise (déjà le cas), gérés
-- depuis Entreprise > Informations plutôt que Paramètres du compte.
--
-- "full_name" reste rempli automatiquement (prenom + " " + nom) pour ne pas
-- casser tous les endroits de l'app qui l'affichent déjà (barre latérale,
-- panneau admin, discussion, etc.).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table profils add column if not exists prenom text;
alter table profils add column if not exists nom text;
alter table profils add column if not exists avatar_url text;

alter table entreprises add column if not exists secteur_activite text;
