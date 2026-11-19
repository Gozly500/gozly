-- ============================================================
-- Suivi des ventes : résumé par JOURNÉE importée (plus de ligne par commande).
-- Gozly ne garde plus les transactions : la page d'une journée les relit chez
-- Wix à chaque ouverture. Ici on garde seulement un résumé par jour : totaux
-- par mode de paiement, taxes, remboursements, nombre de ventes, plus le total
-- Moneris saisi par le client pour concilier.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create table if not exists ventes_jours (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  date date not null,
  source text not null default 'wix',
  nb_en_ligne integer not null default 0,
  nb_comptoir integer not null default 0,
  total_en_ligne numeric(12, 2) not null default 0,
  total_comptoir numeric(12, 2) not null default 0,
  taxes numeric(12, 2) not null default 0,
  pourboires numeric(12, 2) not null default 0,
  remboursements numeric(12, 2) not null default 0,
  -- { "Carte de debit/credit": 1234.50, "Comptant": 200 }
  par_paiement jsonb not null default '{}'::jsonb,
  -- Conciliation : total du rapport Moneris saisi par le client, et état.
  moneris_total numeric(12, 2),
  conciliee boolean not null default false,
  note text,
  importe_le timestamptz not null default now(),
  unique (entreprise_id, date, source)
);

alter table ventes_jours enable row level security;
grant select, insert, update, delete on ventes_jours to authenticated;
grant select, insert, update, delete on ventes_jours to service_role;

drop policy if exists "Lire les journées de ventes de son entreprise" on ventes_jours;
create policy "Lire les journées de ventes de son entreprise"
on ventes_jours for select to authenticated using (est_membre(entreprise_id));

drop policy if exists "Créer les journées de ventes de son entreprise" on ventes_jours;
create policy "Créer les journées de ventes de son entreprise"
on ventes_jours for insert to authenticated with check (est_membre(entreprise_id));

drop policy if exists "Modifier les journées de ventes de son entreprise" on ventes_jours;
create policy "Modifier les journées de ventes de son entreprise"
on ventes_jours for update to authenticated using (est_membre(entreprise_id)) with check (est_membre(entreprise_id));

drop policy if exists "Supprimer les journées de ventes de son entreprise" on ventes_jours;
create policy "Supprimer les journées de ventes de son entreprise"
on ventes_jours for delete to authenticated using (est_membre(entreprise_id));

drop policy if exists "Les admins peuvent tout faire sur ventes_jours" on ventes_jours;
create policy "Les admins peuvent tout faire sur ventes_jours"
on ventes_jours for all to authenticated using (is_admin()) with check (is_admin());

-- Durée de conservation des journées importées (3, 6 ou 12 mois) : Modules > Suivi des ventes.
alter table entreprises add column if not exists ventes_retention_mois integer not null default 12;

-- Export automatique des ventes vers OneDrive / Google Drive.
alter table stockage_connexions add column if not exists export_ventes text not null default 'aucun';
alter table stockage_connexions add column if not exists dernier_export_ventes date;

-- Les anciennes lignes importées de Wix (une par commande) sont remplacées par les journées importées.
-- Les ventes entrées à la main (source_id vide) ne sont pas touchées.
delete from ventes where source in ('wix', 'wix_pos') and source_id is not null;
