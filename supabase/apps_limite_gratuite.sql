-- Une seule app gratuite par compte : la deuxième demande un abonnement (au moins Opale).
create or replace function limiter_apps_gratuites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.proprietaire_id is null then
    return new;
  end if;
  if (select forfait from profils where id = new.proprietaire_id) is null
     and (select count(*) from apps_developpeur where proprietaire_id = new.proprietaire_id) >= 1 then
    raise exception 'limite_apps_gratuites';
  end if;
  return new;
end;
$$;

drop trigger if exists apps_limite_gratuite on apps_developpeur;
create trigger apps_limite_gratuite
before insert on apps_developpeur
for each row execute function limiter_apps_gratuites();
