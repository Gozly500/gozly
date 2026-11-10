-- Avantages des forfaits : numéro de forfait, limite d'employés par entreprise, modules autorisés.
-- À exécuter UNE fois dans le SQL Editor de Supabase (après forfaits_gerables.sql).

-- 1) Nouvelles colonnes. limite_employes NULL = illimité ; modules_autorises NULL = tous les modules.
alter table forfaits add column if not exists numero text;
alter table forfaits add column if not exists limite_employes integer check (limite_employes is null or limite_employes >= 0);
alter table forfaits add column if not exists modules_autorises text[];

-- 2) Un numéro de forfait au hasard (GZ-123456) pour ceux qui n'en ont pas encore, unique.
do $$
declare r record; n text;
begin
  for r in select id from forfaits where numero is null loop
    loop
      n := 'GZ-' || lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
      exit when not exists (select 1 from forfaits where numero = n);
    end loop;
    update forfaits set numero = n where id = r.id;
  end loop;
end $$;
create unique index if not exists forfaits_numero_idx on forfaits (numero);

-- 3) Limite d'employés : refuse l'ajout d'un employé au-delà de la limite du forfait de l'entreprise.
create or replace function verifier_limite_employes() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim integer; nb integer;
begin
  select f.limite_employes into lim
    from entreprises e join forfaits f on f.id = e.forfait
    where e.id = new.entreprise_id;
  if lim is null then return new; end if;
  select count(*) into nb from employes where entreprise_id = new.entreprise_id;
  if nb >= lim then
    raise exception 'LIMITE_EMPLOYES' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists employes_limite_forfait on employes;
create trigger employes_limite_forfait before insert on employes
  for each row execute function verifier_limite_employes();

-- 4) Modules autorisés : refuse l'activation d'un module que le forfait n'inclut pas.
create or replace function verifier_module_autorise() returns trigger
language plpgsql security definer set search_path = public as $$
declare liste text[];
begin
  select f.modules_autorises into liste
    from entreprises e join forfaits f on f.id = e.forfait
    where e.id = new.entreprise_id;
  if liste is not null and not (new.module = any(liste)) then
    raise exception 'MODULE_NON_INCLUS' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists modules_actifs_forfait on modules_actifs;
create trigger modules_actifs_forfait before insert on modules_actifs
  for each row execute function verifier_module_autorise();
