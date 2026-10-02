-- ============================================================
-- Ajout : date/heure de ramassage et lieu des commandes en ligne.
-- Pour un restaurant avec précommandes (ex: Pasta), la date qui compte
-- n'est pas celle où la commande a été passée, mais celle où le client
-- vient la chercher. Wix Restaurants la donne dans le créneau choisi
-- (shippingInfo.logistics.deliveryTimeSlot) et le lieu dans
-- businessLocation (la succursale choisie par le client).
--
-- - date_ramassage / date_ramassage_fin : début et fin du créneau
--   (NULL = pas de date : la date de la commande sert alors de repli).
-- - lieu_id / lieu_nom : succursale / emplacement de la commande.
--
-- Rempli par la synchro Wix, ou à la main pour les commandes manuelles.
-- Les commandes déjà synchronisées sont rattrapées plus bas depuis `brut`.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table commandes_en_ligne add column if not exists date_ramassage timestamptz;
alter table commandes_en_ligne add column if not exists date_ramassage_fin timestamptz;
alter table commandes_en_ligne add column if not exists lieu_id text;
alter table commandes_en_ligne add column if not exists lieu_nom text;

create index if not exists commandes_en_ligne_ramassage_idx
  on commandes_en_ligne (entreprise_id, date_ramassage);

-- Rattrapage des commandes Wix déjà copiées (tant que `brut` existe encore).
-- Le bloc ignore silencieusement une valeur qui ne serait pas une date valide.
do $$
declare
  r record;
begin
  for r in
    select id,
           brut->'shippingInfo'->'logistics'->'deliveryTimeSlot'->>'from' as debut,
           brut->'shippingInfo'->'logistics'->'deliveryTimeSlot'->>'to' as fin,
           brut->'businessLocation'->>'id' as lid,
           brut->'businessLocation'->>'name' as lnom
    from commandes_en_ligne
    where source = 'wix' and brut is not null and date_ramassage is null
  loop
    begin
      update commandes_en_ligne
      set date_ramassage = nullif(r.debut, '')::timestamptz,
          date_ramassage_fin = nullif(r.fin, '')::timestamptz,
          lieu_id = r.lid,
          lieu_nom = r.lnom
      where id = r.id;
    exception when others then
      null;
    end;
  end loop;
end $$;
