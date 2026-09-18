-- ============================================================
-- Ajout : préférences de notifications push par employé (/moi >
-- Paramètres), une case à cocher par type de notification.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- Toutes activées par défaut (true) : l'employé a déjà fait un geste
-- explicite pour activer les notifications sur son appareil (bouton
-- "Activer les notifications"), ces colonnes servent seulement à
-- affiner ensuite quels types il veut recevoir.
alter table employes add column if not exists notif_messages boolean not null default true;
alter table employes add column if not exists notif_conge_traite boolean not null default true;
alter table employes add column if not exists notif_echange_recu boolean not null default true;
alter table employes add column if not exists notif_echange_traite boolean not null default true;
alter table employes add column if not exists notif_semaine_publiee boolean not null default true;
