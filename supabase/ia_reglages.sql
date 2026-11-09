-- ============================================================
-- Permissions de l'IA : ce que les assistants IA branchés à l'entreprise ont le droit de faire,
-- module par module et action par action (Paramètres > Intégrations > Intelligence artificielle > Permissions).
-- Les permissions s'appliquent à TOUTES les connexions de l'entreprise, en direct : pas besoin de reconnecter l'assistant.
--
-- Sans ligne pour une entreprise : tout est permis sauf la publication de l'horaire (désactivée par défaut).
-- RLS activé sans policy -> accessible uniquement via service_role, depuis les routes /api/ia/*.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists ia_reglages (
  entreprise_id uuid primary key references entreprises(id) on delete cascade,
  permissions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table ia_reglages enable row level security;

grant select, insert, update, delete on ia_reglages to service_role;
