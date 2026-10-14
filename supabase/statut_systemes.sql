-- Page de statut publique (/statut) : surcharges manuelles faites par l'admin.
-- Sans ligne ici, l'état d'un système est celui détecté automatiquement.
create table if not exists public.statut_overrides (
  cle text primary key,
  etat text not null check (etat in ('ok', 'probleme', 'panne')),
  message text,
  updated_at timestamptz not null default now()
);

alter table public.statut_overrides enable row level security;
-- Aucune policy : tout passe par les routes API (service_role).

grant select, insert, update, delete on public.statut_overrides to service_role;
