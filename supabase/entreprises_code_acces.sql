-- ============================================================
-- Ajout : code d'accès de l'entreprise, pour que ses employés puissent
-- se connecter à l'app mobile "Gozly Équipe" (code d'entreprise + NIP).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists code_acces text unique;

-- Génère un code à 6 caractères (lettres majuscules + chiffres, sans
-- caractères ambigus) pour toute entreprise qui n'en a pas - à la
-- création (trigger) comme pour les entreprises déjà existantes (backfill).
create or replace function generer_code_acces()
returns trigger as $$
declare
  nouveau_code text;
begin
  if new.code_acces is not null then
    return new;
  end if;

  loop
    nouveau_code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ceil(random() * 33)::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from entreprises where code_acces = nouveau_code);
  end loop;

  new.code_acces := nouveau_code;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_generer_code_acces on entreprises;
create trigger trg_generer_code_acces
before insert on entreprises
for each row
execute function generer_code_acces();

-- Backfill pour les entreprises créées avant l'ajout de cette colonne.
do $$
declare
  rec record;
  nouveau_code text;
begin
  for rec in select id from entreprises where code_acces is null loop
    loop
      nouveau_code := (
        select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', ceil(random() * 33)::int, 1), '')
        from generate_series(1, 6)
      );
      exit when not exists (select 1 from entreprises where code_acces = nouveau_code);
    end loop;
    update entreprises set code_acces = nouveau_code where id = rec.id;
  end loop;
end $$;
