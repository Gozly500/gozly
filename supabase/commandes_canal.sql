-- ============================================================
-- Ajout : canal de vente des commandes (en ligne, point de vente...).
-- Wix donne le canal dans channelInfo.type (WEB, POS, BACKOFFICE_MERCHANT,
-- OTHER_PLATFORM...). Le module Commandes en ligne n'affiche que les
-- commandes qui ne viennent PAS du point de vente (POS) ; les ventes du
-- point de vente restent copiées dans la table, pour le futur suivi des
-- ventes (Wix en ligne + comptoir).
--
-- canal = 'MANUEL' pour les commandes saisies à la main dans Gozly.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table commandes_en_ligne add column if not exists canal text not null default 'WEB';

-- Rattrape les commandes déjà copiées depuis la copie complète (brut).
update commandes_en_ligne
set canal = brut->'channelInfo'->>'type'
where source = 'wix' and brut->'channelInfo'->>'type' is not null;

update commandes_en_ligne set canal = 'MANUEL' where source = 'manuel';

create index if not exists commandes_en_ligne_canal_idx on commandes_en_ligne (entreprise_id, canal, date_commande);
