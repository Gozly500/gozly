-- ============================================================
-- Ajout : demandes de congé et échanges de quarts.
--
-- Congés : l'employé propose des dates + raison optionnelle, l'admin
-- approuve ou refuse toujours manuellement.
--
-- Échanges : "A donne son quart à B" (pas un vrai échange 1-pour-1).
-- B doit accepter en premier (statut_employe). Une fois accepté, selon
-- entreprises.auto_approuver_echanges, soit c'est automatique
-- (statut_admin = 'non_requis', réassignation immédiate du quart),
-- soit l'admin doit encore approuver manuellement.
--
-- Les employés n'ont pas de rôle Postgres dédié : leur accès passe par
-- /api/employe-app/demandes/* (service_role, déjà couvert par
-- service_role_grants.sql). Les policies ci-dessous ne concernent que
-- l'accès direct du dashboard (authenticated).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists demandes_conge (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  employe_id uuid not null references employes(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  raison text,
  statut text not null default 'en_attente', -- 'en_attente' | 'approuve' | 'refuse'
  traite_par uuid references auth.users(id) on delete set null,
  traite_le timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists demandes_echange (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  quart_id uuid not null references planning_quarts(id) on delete cascade,
  employe_donneur_id uuid not null references employes(id) on delete cascade,
  employe_receveur_id uuid not null references employes(id) on delete cascade,
  statut_employe text not null default 'en_attente', -- 'en_attente' | 'accepte' | 'refuse'
  statut_admin text not null default 'en_attente', -- 'en_attente' | 'approuve' | 'refuse' | 'non_requis'
  created_at timestamptz not null default now(),
  traite_le timestamptz
);

alter table entreprises add column if not exists auto_approuver_echanges boolean not null default false;

alter table demandes_conge enable row level security;
alter table demandes_echange enable row level security;

grant select, insert, update on demandes_conge to authenticated;
grant select, insert, update on demandes_echange to authenticated;

-- demandes_conge
drop policy if exists "Voir les demandes de congé de son entreprise" on demandes_conge;
create policy "Voir les demandes de congé de son entreprise"
on demandes_conge for select
to authenticated
using (est_membre(entreprise_id));

drop policy if exists "Modifier les demandes de congé de son entreprise" on demandes_conge;
create policy "Modifier les demandes de congé de son entreprise"
on demandes_conge for update
to authenticated
using (est_membre(entreprise_id))
with check (est_membre(entreprise_id));

-- demandes_echange
drop policy if exists "Voir les demandes d'échange de son entreprise" on demandes_echange;
create policy "Voir les demandes d'échange de son entreprise"
on demandes_echange for select
to authenticated
using (est_membre(entreprise_id));

drop policy if exists "Modifier les demandes d'échange de son entreprise" on demandes_echange;
create policy "Modifier les demandes d'échange de son entreprise"
on demandes_echange for update
to authenticated
using (est_membre(entreprise_id))
with check (est_membre(entreprise_id));
