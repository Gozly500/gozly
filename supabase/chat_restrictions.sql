-- ============================================================
-- Contrôle de la communication par le propriétaire (Employés > Discussion) :
--  - chat_groupes_autorise : l'employé peut créer des groupes de discussion ;
--  - chat_multi_autorise   : l'employé peut envoyer un même message à plusieurs personnes (chacune
--                            le reçoit dans sa propre conversation, sans groupe) ;
--  - chat_blocages         : « cet employé ne peut pas communiquer avec celui-là » (dans les deux
--                            sens : ni l'un ni l'autre ne peut écrire à l'autre en direct).
-- Par défaut tout est permis, rien n'est bloqué.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table employes add column if not exists chat_groupes_autorise boolean not null default true;
alter table employes add column if not exists chat_multi_autorise boolean not null default true;

create table if not exists chat_blocages (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  employe_id uuid not null references employes(id) on delete cascade,
  bloque_id uuid not null references employes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (employe_id, bloque_id),
  check (employe_id <> bloque_id)
);

alter table chat_blocages enable row level security;
grant select, insert, delete on chat_blocages to authenticated;
grant select, insert, update, delete on chat_blocages to service_role;

drop policy if exists "Un membre peut lire les blocages de son entreprise" on chat_blocages;
create policy "Un membre peut lire les blocages de son entreprise"
on chat_blocages for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un membre peut créer des blocages pour son entreprise" on chat_blocages;
create policy "Un membre peut créer des blocages pour son entreprise"
on chat_blocages for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un membre peut retirer les blocages de son entreprise" on chat_blocages;
create policy "Un membre peut retirer les blocages de son entreprise"
on chat_blocages for delete to authenticated using (est_membre(entreprise_id));
