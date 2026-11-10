-- Sépare les employés en extra OFFERTS (donnés par l'admin, colonne employes_extra) des employés en extra ACHETÉS (facturés par Stripe,
-- colonne employes_extra_achetes). La limite d'employés = forfait + offerts + achetés.
-- À exécuter UNE fois dans le SQL Editor de Supabase (après employes_extra.sql).

alter table entreprises add column if not exists employes_extra_achetes integer not null default 0 check (employes_extra_achetes >= 0);

-- Un membre ne peut modifier ni l'un ni l'autre.
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
    new.employes_extra_achetes := 0;
  else
    new.forfait := old.forfait;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.employes_extra := old.employes_extra;
    new.employes_extra_achetes := old.employes_extra_achetes;
  end if;
  return new;
end;
$$;

create or replace function verifier_limite_employes() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim integer; extra integer; nb integer;
begin
  select f.limite_employes, coalesce(e.employes_extra, 0) + coalesce(e.employes_extra_achetes, 0) into lim, extra
    from entreprises e join forfaits f on f.id = e.forfait
    where e.id = new.entreprise_id;
  if lim is null then return new; end if;
  select count(*) into nb from employes where entreprise_id = new.entreprise_id;
  if nb >= lim + extra then
    raise exception 'LIMITE_EMPLOYES' using errcode = 'P0001';
  end if;
  return new;
end $$;
