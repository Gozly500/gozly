-- ============================================================
-- Ajout : ordre des catégories de tâches (réorganisables à la main dans
-- Tâches > Catégories avec les flèches ↑ ↓). Cet ordre s'applique partout :
-- éditeur du jour, kiosque, widget du dashboard et app employé.
--
-- Les catégories déjà créées gardent leur ordre de création.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table categories add column if not exists ordre integer not null default 0;

update categories c
set ordre = sub.rn
from (
  select id, row_number() over (partition by entreprise_id order by created_at, id) as rn
  from categories
) sub
where c.id = sub.id and c.ordre = 0;
