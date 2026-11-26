-- ============================================================
-- Disponibilités : périodes où un employé se déclare disponible, depuis l'app mobile (/moi > Horaire).
-- Heures vides = toute la journée. Le dashboard les lit seulement ; l'écriture passe par
-- /api/employe-app/disponibilites (service_role).
--
-- Aussi : la façon de les afficher dans l'Horaire ('horaire' = dans les cases, 'panneau' = à côté).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists disponibilites (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  employe_id uuid not null references employes(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  heure_debut time,
  heure_fin time,
  note text,
  created_at timestamptz not null default now(),
  check (date_fin >= date_debut)
);

create index if not exists disponibilites_entreprise_dates on disponibilites (entreprise_id, date_fin);

alter table disponibilites enable row level security;

grant select on disponibilites to authenticated;
grant select, insert, update, delete on disponibilites to service_role;

drop policy if exists "Voir les disponibilités de son entreprise" on disponibilites;
create policy "Voir les disponibilités de son entreprise"
on disponibilites for select
to authenticated
using (est_membre(entreprise_id));

alter table entreprises add column if not exists horaire_dispos_affichage text not null default 'horaire';

-- Non-disponibilités (« pas disponible ») : désactivées par défaut, au choix de l'entreprise (Paramètres > Modules > Horaire).
alter table disponibilites add column if not exists disponible boolean not null default true;
alter table entreprises add column if not exists horaire_non_dispo_actif boolean not null default false;
