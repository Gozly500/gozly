-- ============================================================
-- Commandes en ligne : type de commande Wix (Restaurants ou Boutique) + réglages du kiosque.
--  - type_wix : 'restaurant' (Wix Restaurants : 5 statuts) ou 'boutique' (Wix Boutique : préparée ou non).
--    Gozly le détecte tout seul à l'arrivée de la commande (une commande Restaurants a un statut de préparation chez Wix).
--  - commandes_liste_sauter : affichage « Liste » : faux = chaque étape se fait une à la fois ; vrai = « Accepter » saute
--    directement au statut choisi dans « Traitée = statut Wix ».
--  - commandes_terminee_wix : affichage « 3 sections » : le statut Wix que reçoit une commande placée dans la 3e section.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table commandes_en_ligne add column if not exists type_wix text;
alter table entreprises add column if not exists commandes_liste_sauter boolean not null default false;
alter table entreprises add column if not exists commandes_terminee_wix text not null default 'Fulfilled';

-- Rattrape les commandes déjà connues qui ont un statut de préparation Wix : ce sont des commandes Restaurants.
update commandes_en_ligne set type_wix = 'restaurant' where type_wix is null and statut_wix is not null;
