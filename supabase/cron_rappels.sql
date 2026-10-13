-- ============================================================
-- Planification des rappels avec Supabase (pg_cron + pg_net) - fonctionne peu importe le plan Vercel
-- (Vercel Hobby ne permet qu'un passage par jour, avec jusqu'à 1 h de décalage).
--
--  - rappels de pointage : toutes les 5 minutes
--  - rappels de températures : 11 h 30 et 23 h 30 (heure du Québec). pg_cron roule en heure UTC : on
--    planifie aux deux heures possibles (été / hiver), et le code n'envoie que si l'heure du Québec
--    est dans la bonne fenêtre.
--
-- AVANT D'EXÉCUTER : remplace VOTRE_CRON_SECRET (il apparaît 5 fois plus bas : remplace-les tous) par la
-- valeur de la variable CRON_SECRET de Vercel (Settings > Environment Variables). Si ton site n'est pas
-- https://gozly.net, remplace aussi l'adresse.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run. Sans danger de l'exécuter plusieurs fois :
-- les anciennes planifications « gozly-* » sont remplacées.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname like 'gozly-rappels-%';

-- Rappels de pointage : toutes les 5 minutes.
select cron.schedule(
  'gozly-rappels-pointage',
  '*/5 * * * *',
  $$ select net.http_get(
       url := 'https://gozly.net/api/cron/rappels-pointage',
       headers := jsonb_build_object('Authorization', 'Bearer 265b7b47ce414a0a9e44f8e94b4710cdd78a336e88594cd5872d2e647d86b707')
     ); $$
);

-- Rappels de températures : 11 h 30 (matin) et 23 h 30 (soir), heure du Québec, aux deux heures UTC possibles.
select cron.schedule('gozly-rappels-temp-am-ete',   '30 15 * * *', $$ select net.http_get(url := 'https://gozly.net/api/cron/rappels-temperature', headers := jsonb_build_object('Authorization', 'Bearer VOTRE_CRON_SECRET')); $$);
select cron.schedule('gozly-rappels-temp-am-hiver', '30 16 * * *', $$ select net.http_get(url := 'https://gozly.net/api/cron/rappels-temperature', headers := jsonb_build_object('Authorization', 'Bearer VOTRE_CRON_SECRET')); $$);
select cron.schedule('gozly-rappels-temp-pm-ete',   '30 3 * * *',  $$ select net.http_get(url := 'https://gozly.net/api/cron/rappels-temperature', headers := jsonb_build_object('Authorization', 'Bearer VOTRE_CRON_SECRET')); $$);
select cron.schedule('gozly-rappels-temp-pm-hiver', '30 4 * * *',  $$ select net.http_get(url := 'https://gozly.net/api/cron/rappels-temperature', headers := jsonb_build_object('Authorization', 'Bearer VOTRE_CRON_SECRET')); $$);
