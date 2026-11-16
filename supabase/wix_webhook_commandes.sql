-- Webhook de commandes Wix : date du dernier événement de commande reçu pour chaque connexion.
-- Tant qu'un événement est arrivé dans les dernières 24 h, le kiosque ralentit sa synchronisation de secours (aux 5 minutes).
alter table wix_connexions add column if not exists dernier_evenement_commande timestamptz;
