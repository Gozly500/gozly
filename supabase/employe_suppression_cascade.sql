-- ============================================================
-- Décision produit : supprimer un employé supprime vraiment tout ce
-- qui lui est propre (quarts assignés, messages) plutôt que de garder
-- des traces orphelines indéfiniment. C'est déjà le comportement pour
-- les pointages (employe_suppression_cascade.sql : pointages.employe_id
-- est déjà "on delete cascade" depuis le début) - on aligne les quarts
-- planifiés et les messages de discussion sur la même logique.
-- L'interface prévient l'admin de ce qui sera perdu avant de confirmer
-- (voir EmployesSection.jsx).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- planning_quarts.employe_id était "on delete set null" (le quart
-- restait, juste non assigné) - devient "on delete cascade".
do $$
declare
  nom_contrainte text;
begin
  select conname into nom_contrainte
  from pg_constraint
  where conrelid = 'planning_quarts'::regclass
  and contype = 'f'
  and conkey = array[(select attnum from pg_attribute where attrelid = 'planning_quarts'::regclass and attname = 'employe_id')];

  if nom_contrainte is not null then
    execute format('alter table planning_quarts drop constraint %I', nom_contrainte);
  end if;
end $$;

alter table planning_quarts add constraint planning_quarts_employe_id_fkey
  foreign key (employe_id) references employes(id) on delete cascade;

-- messages.employe_id était "on delete set null" (le message restait,
-- affiché "Compte supprimé") - devient "on delete cascade".
do $$
declare
  nom_contrainte text;
begin
  select conname into nom_contrainte
  from pg_constraint
  where conrelid = 'messages'::regclass
  and contype = 'f'
  and conkey = array[(select attnum from pg_attribute where attrelid = 'messages'::regclass and attname = 'employe_id')];

  if nom_contrainte is not null then
    execute format('alter table messages drop constraint %I', nom_contrainte);
  end if;
end $$;

alter table messages add constraint messages_employe_id_fkey
  foreign key (employe_id) references employes(id) on delete cascade;
