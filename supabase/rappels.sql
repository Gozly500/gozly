-- ============================================================
-- Rappels : un message mis en évidence chez ses destinataires (en haut de l'app employé) pendant la durée
-- choisie par celui qui le crée, 1 semaine au maximum. Le propriétaire (dashboard) et les employés
-- (menu « + » de la page Discussion) peuvent en créer, pour tout le monde ou pour des personnes précises.
--
--  - rappels               : le rappel (texte, début / fin, auteur) ;
--  - rappel_destinataires  : les personnes visées quand ce n'est pas « tout le monde » (pour_tous = false) ;
--  - employes.chat_rappels_autorise : le propriétaire peut retirer à un employé le droit d'en créer
--    (Employés > Discussion). Par défaut tout le monde peut.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table employes add column if not exists chat_rappels_autorise boolean not null default true;

create table if not exists rappels (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  contenu text not null,
  debut timestamptz not null default now(),
  fin timestamptz not null,
  auteur_nom text not null, -- nom affiché, conservé même si le compte de l'auteur disparaît
  cree_par_employe uuid references employes(id) on delete cascade,
  cree_par_user uuid references auth.users(id) on delete set null,
  pour_tous boolean not null default true,
  created_at timestamptz not null default now(),
  check (fin > debut),
  check (fin <= debut + interval '7 days')
);

create index if not exists rappels_entreprise_fin on rappels (entreprise_id, fin);

create table if not exists rappel_destinataires (
  rappel_id uuid not null references rappels(id) on delete cascade,
  employe_id uuid not null references employes(id) on delete cascade,
  primary key (rappel_id, employe_id)
);

alter table rappels enable row level security;
alter table rappel_destinataires enable row level security;
grant select, insert, delete on rappels to authenticated;
grant select, insert, delete on rappel_destinataires to authenticated;
grant select, insert, update, delete on rappels to service_role;
grant select, insert, update, delete on rappel_destinataires to service_role;

drop policy if exists "Un membre peut lire les rappels de son entreprise" on rappels;
create policy "Un membre peut lire les rappels de son entreprise"
on rappels for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un membre peut créer des rappels pour son entreprise" on rappels;
create policy "Un membre peut créer des rappels pour son entreprise"
on rappels for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Un membre peut retirer les rappels de son entreprise" on rappels;
create policy "Un membre peut retirer les rappels de son entreprise"
on rappels for delete to authenticated using (est_membre(entreprise_id));

drop policy if exists "Un membre peut lire les destinataires des rappels de son entreprise" on rappel_destinataires;
create policy "Un membre peut lire les destinataires des rappels de son entreprise"
on rappel_destinataires for select to authenticated
using (exists (select 1 from rappels r where r.id = rappel_id and est_membre(r.entreprise_id)));

drop policy if exists "Un membre peut ajouter des destinataires aux rappels de son entreprise" on rappel_destinataires;
create policy "Un membre peut ajouter des destinataires aux rappels de son entreprise"
on rappel_destinataires for insert to authenticated
with check (exists (select 1 from rappels r where r.id = rappel_id and est_membre(r.entreprise_id)));

drop policy if exists "Un membre peut retirer les destinataires des rappels de son entreprise" on rappel_destinataires;
create policy "Un membre peut retirer les destinataires des rappels de son entreprise"
on rappel_destinataires for delete to authenticated
using (exists (select 1 from rappels r where r.id = rappel_id and est_membre(r.entreprise_id)));
