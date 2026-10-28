-- ============================================================
-- Ajout : connexion d'une entreprise à son stockage en ligne (OneDrive
-- pour l'instant, Google Drive plus tard) afin d'y déposer automatiquement
-- des fichiers (fiches de température en CSV, chaque semaine ou chaque mois).
--
-- Le jeton d'actualisation OAuth est chiffré (AES-256-GCM, même clé que
-- les identifiants de paie : PAYROLL_ENCRYPTION_KEY) avant d'être stocké.
-- Comme paie_connexions / wix_connexions, RLS est activé sans policy pour
-- "authenticated" : accessible uniquement via service_role, depuis les
-- routes /api/stockage/*.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists stockage_connexions (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  fournisseur text not null check (fournisseur in ('microsoft', 'google')),
  compte_email text,
  jeton_actualisation_chiffre text not null,
  statut text not null default 'connecte' check (statut in ('connecte', 'a_reconnecter')),
  export_temperatures text not null default 'aucun' check (export_temperatures in ('aucun', 'hebdo', 'mensuel')),
  dernier_export_temperatures date,
  derniere_erreur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entreprise_id, fournisseur)
);

alter table stockage_connexions enable row level security;

grant select, insert, update, delete on stockage_connexions to service_role;
