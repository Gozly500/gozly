-- Modèle « Wix » du kiosque des commandes : statut de préparation Wix de chaque commande, et réglage « Traitée = statut Wix ».
-- Le mode d'affichage 'wix' se choisit dans Personnalisation (aucun changement de table : commandes_kiosque_mode est un simple texte).
alter table commandes_en_ligne add column if not exists statut_wix text;
alter table commandes_en_ligne add column if not exists wix_fulfillment_id text;
alter table entreprises add column if not exists commandes_traitee_wix text not null default 'Accepted';
