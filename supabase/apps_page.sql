-- Page de gestion d'une app (affichée dans Gozly) : adresse, accord aux règles de design, clé qui signe le jeton envoyé à la page.
alter table apps_developpeur add column if not exists url_page text;
alter table apps_developpeur add column if not exists regles_page_le timestamptz;
alter table apps_developpeur add column if not exists secret_page text not null
  default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
