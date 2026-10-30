-- Annuler ou modifier une commande en ligne (Wix) depuis Gozly.
-- Wix reste en lecture seule : l'annulation et les modifications ne sont gardées que dans Gozly.
-- Ces deux colonnes disent à la synchronisation de ne pas écraser ce qui a été changé dans Gozly.
alter table commandes_en_ligne add column if not exists annulee_gozly boolean not null default false;
alter table commandes_en_ligne add column if not exists modifiee_gozly boolean not null default false;
