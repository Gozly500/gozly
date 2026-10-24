-- ============================================================
-- Ajout : son des nouvelles commandes en ligne dans le kiosque des commandes, au choix dans
-- Personnalisation > Commandes en ligne (valable pour l'affichage en liste comme en 3 sections) :
--   'une_fois' : le son joue une seule fois à l'arrivée d'une commande en ligne ;
--   'continu'  : le son se répète tant que la commande n'a pas été prise en charge
--                (3 sections : tant qu'elle est « En attente » ; liste : jusqu'à ce qu'on la touche ou qu'on arrête le son).
-- Pour ne rien changer au comportement actuel, les entreprises existantes reçoivent
-- 'continu' si leur kiosque est en 3 sections, 'une_fois' s'il est en liste.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists commandes_son_mode text not null default 'une_fois';

update entreprises
set commandes_son_mode = case when commandes_kiosque_mode = 'sections' then 'continu' else 'une_fois' end
where commandes_son_mode = 'une_fois';
