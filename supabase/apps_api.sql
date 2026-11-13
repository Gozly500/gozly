-- API pour les apps de développeurs : clé par app, limites d'usage, suspension.
alter table apps_developpeur add column if not exists suspendue boolean not null default false;
alter table apps_developpeur add column if not exists suspendue_raison text;
alter table apps_developpeur add column if not exists cle_api_hash text;
alter table apps_developpeur add column if not exists cle_api_prefixe text;
alter table apps_developpeur add column if not exists limite_min_entreprise int not null default 30;
alter table apps_developpeur add column if not exists limite_min_app int not null default 120;
alter table apps_developpeur add column if not exists limite_jour int not null default 5000;
create unique index if not exists apps_developpeur_cle_api_hash_idx on apps_developpeur (cle_api_hash) where cle_api_hash is not null;

-- Un développeur ne peut pas toucher à la suspension, aux limites ni à la clé : seuls l'admin et le serveur le peuvent.
create or replace function proteger_reglages_api_app()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not is_admin() then
    if tg_op = 'INSERT' then
      new.suspendue := false;
      new.suspendue_raison := null;
      new.cle_api_hash := null;
      new.cle_api_prefixe := null;
      new.limite_min_entreprise := 30;
      new.limite_min_app := 120;
      new.limite_jour := 5000;
    else
      new.suspendue := old.suspendue;
      new.suspendue_raison := old.suspendue_raison;
      new.cle_api_hash := old.cle_api_hash;
      new.cle_api_prefixe := old.cle_api_prefixe;
      new.limite_min_entreprise := old.limite_min_entreprise;
      new.limite_min_app := old.limite_min_app;
      new.limite_jour := old.limite_jour;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists apps_proteger_reglages_api on apps_developpeur;
create trigger apps_proteger_reglages_api
before insert or update on apps_developpeur
for each row execute function proteger_reglages_api_app();

-- Compteurs d'usage (par minute et par jour, par app et par entreprise).
create table if not exists app_usage_minute (
  app_id uuid not null references apps_developpeur(id) on delete cascade,
  entreprise_id uuid not null,
  minute timestamptz not null,
  n int not null default 0,
  primary key (app_id, entreprise_id, minute)
);
create table if not exists app_usage_jour (
  app_id uuid not null references apps_developpeur(id) on delete cascade,
  entreprise_id uuid not null,
  jour date not null,
  n int not null default 0,
  primary key (app_id, entreprise_id, jour)
);
alter table app_usage_minute enable row level security;
alter table app_usage_jour enable row level security;
grant select, insert, update, delete on app_usage_minute to service_role;
grant select, insert, update, delete on app_usage_jour to service_role;

-- Compte un appel et dit s'il passe : 'ok', 'minute_entreprise', 'minute_app', 'jour' ou 'suspendue'.
-- Une app qui dépasse cinq fois sa limite par minute est suspendue automatiquement.
create or replace function compter_appel_app(p_app uuid, p_ent uuid, p_lim_min_ent int, p_lim_min_app int, p_lim_jour int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minute timestamptz := date_trunc('minute', now());
  v_jour date := (now() at time zone 'utc')::date;
  n_ent int;
  n_app int;
  n_jour int;
begin
  insert into app_usage_minute (app_id, entreprise_id, minute, n) values (p_app, p_ent, v_minute, 1)
  on conflict (app_id, entreprise_id, minute) do update set n = app_usage_minute.n + 1
  returning n into n_ent;

  insert into app_usage_jour (app_id, entreprise_id, jour, n) values (p_app, p_ent, v_jour, 1)
  on conflict (app_id, entreprise_id, jour) do update set n = app_usage_jour.n + 1;

  select coalesce(sum(n), 0) into n_app from app_usage_minute where app_id = p_app and minute = v_minute;
  select coalesce(sum(n), 0) into n_jour from app_usage_jour where app_id = p_app and jour = v_jour;

  if random() < 0.01 then
    delete from app_usage_minute where minute < now() - interval '1 day';
    delete from app_usage_jour where jour < v_jour - 60;
  end if;

  if n_app > p_lim_min_app * 5 then
    update apps_developpeur set suspendue = true, suspendue_raison = 'Suspendue automatiquement : limites dépassées de beaucoup.' where id = p_app;
    return 'suspendue';
  end if;
  if n_ent > p_lim_min_ent then return 'minute_entreprise'; end if;
  if n_app > p_lim_min_app then return 'minute_app'; end if;
  if n_jour > p_lim_jour then return 'jour'; end if;
  return 'ok';
end;
$$;
grant execute on function compter_appel_app(uuid, uuid, int, int, int) to service_role;
