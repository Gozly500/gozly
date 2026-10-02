-- ============================================================
-- Ajout : kiosque des commandes en ligne (3 boîtes : En attente /
-- Traitées / Terminées). Wix ne connaît que "préparée ou non", donc
-- l'étape du kiosque est gardée dans Gozly seulement, dans `etape`
-- (NULL = pas encore touchée : déduite du statut Wix, voir lib/commandes.js).
-- Le changement d'étape passe par /api/commandes/etape (service_role),
-- donc aucune policy à élargir : les commandes Wix restent en lecture
-- seule côté client.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table commandes_en_ligne add column if not exists etape text;

alter table commandes_en_ligne drop constraint if exists commandes_en_ligne_etape_check;
alter table commandes_en_ligne add constraint commandes_en_ligne_etape_check
  check (etape is null or etape in ('en_attente', 'traitee', 'terminee'));
