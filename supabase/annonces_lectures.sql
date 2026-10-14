-- ============================================================
-- Accusés de lecture des annonces : quand un employé touche « OK » sur une annonce, on l'enregistre ici, et le
-- propriétaire voit « Lu par 7 sur 9 » (et qui n'a pas encore lu) dans Discussion > + Nouveau > Annonce.
-- Une ligne par employé et par annonce (~150 octets : quelques Mo par année, même avec beaucoup d'employés).
-- Elles disparaissent avec l'annonce, que le nettoyage quotidien supprime 30 jours après son expiration.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run (après annonces.sql)
-- ============================================================

create table if not exists annonce_lectures (
  annonce_id uuid not null references annonces(id) on delete cascade,
  employe_id uuid not null references employes(id) on delete cascade,
  lu_le timestamptz not null default now(),
  primary key (annonce_id, employe_id)
);

alter table annonce_lectures enable row level security;
grant select on annonce_lectures to authenticated;
grant select, insert, update, delete on annonce_lectures to service_role;

drop policy if exists "Un membre peut lire les accusés de lecture de son entreprise" on annonce_lectures;
create policy "Un membre peut lire les accusés de lecture de son entreprise"
on annonce_lectures for select to authenticated
using (exists (select 1 from annonces a where a.id = annonce_id and est_membre(a.entreprise_id)));
