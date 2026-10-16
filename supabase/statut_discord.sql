-- ============================================================
-- Alertes de statut dans Discord (Gozyx annonce dans le salon des statuts quand un système change d'état).
--
-- 1) Table qui garde le dernier état annoncé de chaque système (pour détecter les changements).
-- 2) Planification toutes les 5 minutes (pg_cron + pg_net, comme les rappels : voir cron_rappels.sql).
--
-- AVANT D'EXÉCUTER : remplace VOTRE_CLE_STATUT (une seule fois, plus bas) par la valeur de la variable
-- STATUT_CRON_SECRET que tu crées dans Vercel (une longue suite de lettres et de chiffres au hasard,
-- 16 caractères ou plus). Si ton site n'est pas https://gozly.net, remplace aussi l'adresse.
--
-- Sans danger de l'exécuter plusieurs fois (l'ancienne planification « gozly-statut-discord » est remplacée).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists statut_discord_etat (
  cle text primary key,
  etat text not null check (etat in ('ok', 'probleme', 'panne')),
  candidat text check (candidat in ('ok', 'probleme', 'panne')),  -- nouvel état vu une première fois, pas encore annoncé
  candidat_n int not null default 0,
  maj timestamptz not null default now()
);

alter table statut_discord_etat enable row level security;
grant all on statut_discord_etat to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'gozly-statut-discord';

select cron.schedule(
  'gozly-statut-discord',
  '*/5 * * * *',
  $$ select net.http_get(
       url := 'https://gozly.net/api/cron/statut-discord',
       headers := jsonb_build_object('Authorization', 'Bearer VOTRE_CLE_STATUT')
     ); $$
);
