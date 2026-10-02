-- ============================================================
-- Ajout : durée de conservation des commandes en ligne copiées depuis
-- Wix, configurable par entreprise dans Personnalisation > Commandes
-- en ligne (6, 12 ou 24 mois - 12 par défaut). Le vrai registre reste
-- chez Wix ; Gozly n'en garde qu'une copie à durée limitée.
-- Les commandes saisies à la main (source = 'manuel') ne sont JAMAIS
-- supprimées automatiquement : elles n'existent nulle part ailleurs.
-- Le nettoyage se fait dans /api/cron/nettoyer-commandes (Vercel Cron,
-- voir vercel.json). Le même cron vide aussi la colonne `brut` (copie
-- complète de la commande Wix) après 60 jours pour alléger la base.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists commandes_retention_mois integer not null default 12;

alter table entreprises drop constraint if exists entreprises_commandes_retention_mois_check;
alter table entreprises add constraint entreprises_commandes_retention_mois_check
  check (commandes_retention_mois in (6, 12, 24));

grant select, insert, update, delete on commandes_en_ligne to service_role;
