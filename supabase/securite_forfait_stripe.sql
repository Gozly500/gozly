-- ============================================================
-- Sécurité : le forfait et les identifiants Stripe d'une entreprise ne
-- peuvent plus être modifiés par un simple membre.
--
-- Avant : la règle RLS "un membre peut modifier son entreprise" (equipe.sql)
-- couvrait TOUTES les colonnes, donc n'importe quel membre pouvait, depuis
-- la console de son navigateur, mettre forfait = 'crystal' sans payer. Le
-- formulaire d'inscription écrivait aussi le forfait directement.
--
-- Maintenant : forfait, stripe_customer_id et stripe_subscription_id ne
-- changent que via
--   - service_role (webhook Stripe, création du client Stripe, cron), ou
--   - un admin Gozly (panneau admin), ou
--   - le SQL Editor de Supabase (rôle postgres).
-- Pour un membre normal, ces colonnes sont ignorées à l'insertion (NULL) et
-- gardent leur ancienne valeur à la modification (sans erreur, pour ne pas
-- casser les mises à jour légitimes des autres colonnes).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function proteger_champs_abonnement()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Les requêtes venant du navigateur/de l'API avec le jeton d'un
  -- utilisateur tournent sous le rôle 'authenticated' (ou 'anon'). Les
  -- autres rôles (service_role, postgres...) sont de confiance.
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

drop trigger if exists entreprises_proteger_abonnement on entreprises;
create trigger entreprises_proteger_abonnement
before insert or update on entreprises
for each row execute function proteger_champs_abonnement();

-- ------------------------------------------------------------
-- Vérification (à lancer après, dans le SQL Editor) :
--   select tgname from pg_trigger where tgname = 'entreprises_proteger_abonnement';
-- doit retourner une ligne.
-- ------------------------------------------------------------
