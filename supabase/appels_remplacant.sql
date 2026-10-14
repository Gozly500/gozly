-- ============================================================
-- Appel de remplaçant : un employé qui ne peut pas faire son quart (en entier ou en partie) lance un appel ;
-- ses collègues disponibles reçoivent une notification et le voient dans leurs Notifications (cloche). Le premier
-- qui touche « Je prends » obtient le quart : ça crée une demande d'échange déjà acceptée par les deux employés,
-- que tu approuves dans Demandes (ou qui s'applique tout de suite si les échanges sont en approbation automatique).
--
-- Un appel est supprimé automatiquement 30 jours après sa création (nettoyage quotidien).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists appels_remplacant (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  quart_id uuid not null references planning_quarts(id) on delete cascade,
  demandeur_id uuid not null references employes(id) on delete cascade,
  heure_debut time, -- vide = le quart au complet
  heure_fin time,
  note text,
  statut text not null default 'ouvert', -- 'ouvert' | 'pris'
  repreneur_id uuid references employes(id) on delete set null,
  pris_le timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists appels_remplacant_entreprise_statut on appels_remplacant (entreprise_id, statut);

alter table appels_remplacant enable row level security;
grant select, insert, update, delete on appels_remplacant to service_role;
