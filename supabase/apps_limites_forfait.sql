-- Limites des apps de développeurs selon le forfait du compte.
--   Gratuit (compte sans forfait) : 1 app, limites d'API de base (30/min par entreprise, 120/min par app, 5 000/jour)
--   Opale                         : 2 apps, limites plus larges
--   Onyx et Crystal               : 5 apps, limites encore plus larges (les mêmes pour les deux)
-- Les valeurs vivent dans la table forfaits (NULL = pas de plafond pour limite_apps). Rejouable sans danger.

-- 1) Colonnes sur les forfaits.
alter table forfaits add column if not exists limite_apps integer check (limite_apps is null or limite_apps >= 0);
alter table forfaits add column if not exists api_limite_min_entreprise integer check (api_limite_min_entreprise is null or api_limite_min_entreprise >= 1);
alter table forfaits add column if not exists api_limite_min_app integer check (api_limite_min_app is null or api_limite_min_app >= 1);
alter table forfaits add column if not exists api_limite_jour integer check (api_limite_jour is null or api_limite_jour >= 1);

-- 2) Valeurs de départ (seulement si la case est encore vide : ne réécrase pas un changement fait ensuite).
update forfaits set
  limite_apps = coalesce(limite_apps, 2),
  api_limite_min_entreprise = coalesce(api_limite_min_entreprise, 60),
  api_limite_min_app = coalesce(api_limite_min_app, 240),
  api_limite_jour = coalesce(api_limite_jour, 10000)
where id = 'opale';

update forfaits set
  limite_apps = coalesce(limite_apps, 5),
  api_limite_min_entreprise = coalesce(api_limite_min_entreprise, 120),
  api_limite_min_app = coalesce(api_limite_min_app, 480),
  api_limite_jour = coalesce(api_limite_jour, 25000)
where id in ('onyx', 'crystal');

-- 3) Les limites propres à une app (fixées par l'admin) deviennent facultatives : NULL = on suit le forfait du développeur.
--    Les apps qui avaient encore les valeurs de départ (30 / 120 / 5 000) repassent sur « suivre le forfait ».
alter table apps_developpeur alter column limite_min_entreprise drop not null;
alter table apps_developpeur alter column limite_min_entreprise drop default;
alter table apps_developpeur alter column limite_min_app drop not null;
alter table apps_developpeur alter column limite_min_app drop default;
alter table apps_developpeur alter column limite_jour drop not null;
alter table apps_developpeur alter column limite_jour drop default;
update apps_developpeur set limite_min_entreprise = null where limite_min_entreprise = 30;
update apps_developpeur set limite_min_app = null where limite_min_app = 120;
update apps_developpeur set limite_jour = null where limite_jour = 5000;

-- Un développeur ne fixe pas lui-même ses limites : à la création elles restent vides (= forfait).
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
      new.limite_min_entreprise := null;
      new.limite_min_app := null;
      new.limite_jour := null;
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

-- 4) Nombre d'apps par compte selon le forfait (compte sans forfait = 1 app).
--    Forfait sans plafond (limite_apps vide, ex. Pilote) ou forfait inconnu : pas de limite.
create or replace function limiter_apps_gratuites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_forfait text;
  v_lim integer;
  v_nb integer;
begin
  if new.proprietaire_id is null then
    return new;
  end if;
  select forfait into v_forfait from profils where id = new.proprietaire_id;
  if v_forfait is null then
    v_lim := 1;
  else
    select limite_apps into v_lim from forfaits where id = v_forfait;
  end if;
  if v_lim is null then
    return new;
  end if;
  select count(*) into v_nb from apps_developpeur where proprietaire_id = new.proprietaire_id;
  if v_nb >= v_lim then
    raise exception 'limite_apps:%', v_lim;
  end if;
  return new;
end;
$$;

drop trigger if exists apps_limite_gratuite on apps_developpeur;
create trigger apps_limite_gratuite
before insert on apps_developpeur
for each row execute function limiter_apps_gratuites();
