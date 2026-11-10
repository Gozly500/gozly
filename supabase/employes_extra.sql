-- Employés en extra (blocs de 5) : s'ajoutent à la limite d'employés du forfait, par entreprise.
-- À exécuter UNE fois dans le SQL Editor de Supabase (après forfaits_avantages.sql).

alter table entreprises add column if not exists employes_extra integer not null default 0 check (employes_extra >= 0);

-- Un membre ne peut pas se donner des extras : comme le forfait, seul un admin / le serveur le change.
create or replace function proteger_champs_abonnement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.forfait := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.employes_extra := 0;
  else
    new.forfait := old.forfait;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.employes_extra := old.employes_extra;
  end if;
  return new;
end;
$$;

-- La limite d'employés = limite du forfait + extras de l'entreprise.
create or replace function verifier_limite_employes() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim integer; extra integer; nb integer;
begin
  select f.limite_employes, coalesce(e.employes_extra, 0) into lim, extra
    from entreprises e join forfaits f on f.id = e.forfait
    where e.id = new.entreprise_id;
  if lim is null then return new; end if;
  select count(*) into nb from employes where entreprise_id = new.entreprise_id;
  if nb >= lim + extra then
    raise exception 'LIMITE_EMPLOYES' using errcode = 'P0001';
  end if;
  return new;
end $$;
