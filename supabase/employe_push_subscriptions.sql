-- ============================================================
-- Ajout : abonnements aux notifications push pour l'app mobile employé
-- ("Gozly Équipe" - /moi). Un employé peut avoir plusieurs abonnements
-- (un par appareil/navigateur où il a activé les notifications).
--
-- Comme employe_sessions.sql : ne doit jamais être lisible/écrivable
-- depuis le client. RLS activé, aucune policy pour "authenticated" -
-- accessible uniquement via service_role, donc uniquement depuis les
-- routes /api/employe-app/notifications/* et lib/pushServer.js.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists employe_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  employe_id uuid not null references employes(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists employe_push_subscriptions_employe on employe_push_subscriptions (employe_id);

alter table employe_push_subscriptions enable row level security;
