-- ============================================================
-- Pop-ups d'ouverture (« Gozly a été mis à jour », nouveautés, communiqués)
-- Écrits dans le panneau admin (Annonces > Pop-ups d'ouverture) et affichés UNE SEULE FOIS à chaque personne
-- à l'ouverture de l'app (employés : app Gozly Équipe ; gestionnaires : tableau de bord et app Gestion).
--
-- 1) popups_app : le message (titre + texte avec **gras**, listes « - », liens), les gens visés, actif ou non.
-- 2) popups_vus : qui l'a déjà vu (un employé OU un utilisateur du tableau de bord), pour ne l'afficher qu'une fois.
--
-- Les lectures et écritures passent par le serveur (clé service_role) : RLS activé sans policy.
-- Sûr à réexécuter.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists popups_app (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  contenu text not null default '',
  cibles text[] not null default '{employes}',   -- 'employes' = app Gozly Équipe ; 'gestion' = tableau de bord + app Gestion
  actif boolean not null default false,          -- false = brouillon / désactivé (personne ne le voit)
  active_le timestamptz,                         -- moment de la dernière activation (les plus anciens s'affichent d'abord)
  cree_par text,
  created_at timestamptz not null default now(),
  maj timestamptz not null default now()
);

create table if not exists popups_vus (
  id uuid primary key default gen_random_uuid(),
  popup_id uuid not null references popups_app(id) on delete cascade,
  employe_id uuid references employes(id) on delete cascade,
  user_id uuid,                                  -- utilisateur du tableau de bord (auth.users)
  vu_le timestamptz not null default now(),
  check ((employe_id is not null)::int + (user_id is not null)::int = 1)
);

create unique index if not exists popups_vus_employe_idx on popups_vus (popup_id, employe_id) where employe_id is not null;
create unique index if not exists popups_vus_user_idx on popups_vus (popup_id, user_id) where user_id is not null;

alter table popups_app enable row level security;
alter table popups_vus enable row level security;
grant all on popups_app to service_role;
grant all on popups_vus to service_role;
