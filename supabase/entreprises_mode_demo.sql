-- ============================================================
-- Mode démo d'une entreprise : le pointage mobile ne vérifie plus la distance à la succursale.
-- Sert au compte de test donné à Google pour la révision de l'app (le testeur n'est pas sur place).
-- Jamais exposé dans le dashboard : s'active à la main, pour une seule entreprise.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists mode_demo boolean not null default false;

-- Active-le ensuite pour l'entreprise de démo (remplace le nom par celui de ton entreprise de test) :
-- update entreprises set mode_demo = true where nom = 'Gozly [TEST]';
