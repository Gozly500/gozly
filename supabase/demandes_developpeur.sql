-- Demandes de compte développeur : une par compte. L'accès développeur = une demande « approuvee ».
-- Le compte peut créer SA demande (en attente) et la lire ; seul l'admin (via l'API serveur) la traite.
create table if not exists demandes_developpeur (
  id uuid primary key default gen_random_uuid(),
  profil_id uuid not null unique references profils(id) on delete cascade,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'approuvee', 'refusee')),
  created_at timestamptz not null default now(),
  traitee_le timestamptz
);

alter table demandes_developpeur enable row level security;

drop policy if exists "Lire sa demande développeur" on demandes_developpeur;
create policy "Lire sa demande développeur"
on demandes_developpeur for select
to authenticated
using (profil_id = auth.uid());

drop policy if exists "Créer sa demande développeur" on demandes_developpeur;
create policy "Créer sa demande développeur"
on demandes_developpeur for insert
to authenticated
with check (profil_id = auth.uid() and statut = 'en_attente');

grant select, insert on demandes_developpeur to authenticated;
grant all on demandes_developpeur to service_role;
