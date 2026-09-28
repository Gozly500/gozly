-- ============================================================
-- Changement de modèle : le forfait et l'abonnement Stripe appartiennent
-- maintenant au COMPTE (une seule facture pour toutes les entreprises que
-- ce compte possède), et non plus à chaque entreprise séparément. Un
-- propriétaire qui veut vraiment une facture distincte pour une autre
-- entreprise utilise un compte différent - ce n'est pas ce que permet
-- cette fonctionnalité.
--
-- "entreprises.forfait/stripe_customer_id/stripe_subscription_id" restent
-- en place : tout le code qui vérifie le forfait pour UNE entreprise donnée
-- (barre latérale, blocage de modules, Personnalisation, panneau admin)
-- continue de les lire sans aucun changement. Ils deviennent une COPIE
-- tenue à jour automatiquement par les deux déclencheurs ci-dessous, dès
-- que le forfait du compte change (paiement Stripe, panneau admin) ou
-- qu'une nouvelle entreprise est créée.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table profils add column if not exists forfait text;
alter table profils add column if not exists stripe_customer_id text;
alter table profils add column if not exists stripe_subscription_id text;

-- ------------------------------------------------------------
-- 1) Protection : comme pour "entreprises" (voir securite_forfait_stripe.sql),
--    un membre normal ne peut pas s'auto-attribuer un forfait ou changer les
--    identifiants Stripe en modifiant son profil depuis la console du
--    navigateur - seuls service_role (webhook Stripe) et un admin le peuvent.
-- ------------------------------------------------------------
create or replace function proteger_champs_abonnement_compte()
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
  else
    new.forfait := old.forfait;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
  end if;

  return new;
end;
$$;

drop trigger if exists profils_proteger_abonnement on profils;
create trigger profils_proteger_abonnement
before insert or update on profils
for each row execute function proteger_champs_abonnement_compte();

-- ------------------------------------------------------------
-- 2) Propagation : dès que le forfait du compte change (paiement, admin),
--    recopie la même valeur sur TOUTES les entreprises dont ce compte est
--    propriétaire.
-- ------------------------------------------------------------
create or replace function propager_forfait_compte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.forfait is distinct from old.forfait then
    update entreprises
    set forfait = new.forfait
    where id in (select entreprise_id from membres where user_id = new.id and role = 'proprietaire');
  end if;
  return new;
end;
$$;

drop trigger if exists profils_propager_forfait on profils;
create trigger profils_propager_forfait
after update of forfait on profils
for each row execute function propager_forfait_compte();

-- ------------------------------------------------------------
-- 3) Nouvelle entreprise : dès qu'un compte devient propriétaire d'une
--    entreprise (inscription, ou "+ Créer une entreprise"), cette entreprise
--    hérite immédiatement du forfait déjà payé par ce compte (null si le
--    compte n'a encore rien payé - une inscription toute neuve, par exemple).
-- ------------------------------------------------------------
create or replace function synchroniser_forfait_nouvelle_entreprise()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'proprietaire' then
    update entreprises
    set forfait = (select forfait from profils where id = new.user_id)
    where id = new.entreprise_id;
  end if;
  return new;
end;
$$;

drop trigger if exists membres_synchroniser_forfait on membres;
create trigger membres_synchroniser_forfait
after insert on membres
for each row execute function synchroniser_forfait_nouvelle_entreprise();

-- ------------------------------------------------------------
-- 4) Backfill (une seule fois) : donne à chaque compte propriétaire le
--    meilleur forfait (et les identifiants Stripe correspondants, s'il y en
--    a) parmi les entreprises qu'il possédait déjà avant ce changement de
--    modèle. Rejouable sans danger (ne touche pas un profil déjà à jour).
-- ------------------------------------------------------------
with rang as (
  select
    m.user_id,
    e.forfait,
    e.stripe_customer_id,
    e.stripe_subscription_id,
    case e.forfait
      when 'crystal' then 4
      when 'pilote' then 4
      when 'onyx' then 3
      when 'opale' then 2
      else 1
    end as priorite
  from membres m
  join entreprises e on e.id = m.entreprise_id
  where m.role = 'proprietaire'
),
meilleur as (
  select distinct on (user_id) user_id, forfait, stripe_customer_id, stripe_subscription_id
  from rang
  order by user_id, priorite desc
)
update profils p
set forfait = meilleur.forfait,
    stripe_customer_id = meilleur.stripe_customer_id,
    stripe_subscription_id = meilleur.stripe_subscription_id
from meilleur
where meilleur.user_id = p.id
  and p.forfait is null;

-- ------------------------------------------------------------
-- Vérification (à lancer après) :
--   select tgname from pg_trigger
--   where tgname in ('profils_proteger_abonnement','profils_propager_forfait','membres_synchroniser_forfait');
-- doit retourner 3 lignes.
-- ------------------------------------------------------------
