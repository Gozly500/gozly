-- Forfaits gérables depuis le panneau admin (onglet « Abonnements ») : les limites (modules, entreprises) et les clés de
-- recherche Stripe ne sont plus écrites en dur dans le code.
-- À exécuter UNE fois dans le SQL Editor de Supabase. Tant que ce fichier n'est pas exécuté, Gozly continue de fonctionner
-- avec les valeurs d'avant (Opale, Onyx, Crystal, Pilote).

-- 1) Les forfaits. limite_* NULL = illimité. « publique » = offert aux clients sur le site ; « personnalise » = créé pour UN client.
create table if not exists forfaits (
  id text primary key,
  label text not null,
  limite_modules integer check (limite_modules is null or limite_modules >= 0),
  limite_entreprises integer check (limite_entreprises is null or limite_entreprises >= 0),
  publique boolean not null default false,
  personnalise boolean not null default false,
  actif boolean not null default true,
  ordre integer not null default 100,
  created_at timestamptz not null default now()
);

-- 2) Les clés de recherche Stripe (lookup keys) de chaque forfait : une clé = un prix Stripe, mensuel ou annuel.
create table if not exists forfaits_cles (
  cle text primary key,
  forfait_id text not null references forfaits(id) on delete cascade,
  periode text not null default 'mensuel' check (periode in ('mensuel', 'annuel')),
  created_at timestamptz not null default now()
);
create index if not exists forfaits_cles_forfait_idx on forfaits_cles (forfait_id);

-- 3) Sécurité : tout utilisateur connecté peut LIRE (les limites s'affichent dans l'app) ; seul le serveur écrit
--    (panneau admin, via la clé service_role).
alter table forfaits enable row level security;
alter table forfaits_cles enable row level security;

drop policy if exists forfaits_lecture on forfaits;
create policy forfaits_lecture on forfaits for select to authenticated using (true);

drop policy if exists forfaits_cles_lecture on forfaits_cles;
create policy forfaits_cles_lecture on forfaits_cles for select to authenticated using (true);

grant select on forfaits, forfaits_cles to authenticated;
grant all on forfaits, forfaits_cles to service_role;

-- 4) Les forfaits actuels (ne remplace rien s'ils existent déjà).
insert into forfaits (id, label, limite_modules, limite_entreprises, publique, personnalise, actif, ordre) values
  ('opale',   'Opale',   3,    1,    true,  false, true, 1),
  ('onyx',    'Onyx',    5,    3,    true,  false, true, 2),
  ('crystal', 'Crystal', null, 5,    true,  false, true, 3),
  ('pilote',  'Pilote',  null, null, false, false, true, 99)
on conflict (id) do nothing;

insert into forfaits_cles (cle, forfait_id, periode) values
  ('opale',          'opale',   'mensuel'),
  ('opale_annuel',   'opale',   'annuel'),
  ('onyx',           'onyx',    'mensuel'),
  ('onyx_annuel',    'onyx',    'annuel'),
  ('crystal',        'crystal', 'mensuel'),
  ('crystal_annuel', 'crystal', 'annuel')
on conflict (cle) do nothing;
