-- Mode de paiement d'une commande (carte, comptant...), imprimé sur le bon de commande.
-- Commandes Wix : lu chez Wix à la synchronisation. Commandes manuelles : choisi à la saisie (Comptant, Carte, Autre).
alter table commandes_en_ligne add column if not exists methode_paiement text;
