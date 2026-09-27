-- ============================================================
-- Permet de supprimer un compte (Supabase > Authentication > Users >
-- Delete user) même s'il est référencé par des colonnes comme
-- invitations.invited_by ou permissions_horaire.approuve_par.
--
-- Avant : ces colonnes référencent auth.users(id) SANS règle de suppression
-- (NO ACTION), donc Postgres refuse de supprimer l'utilisateur
-- ("Database error deleting user").
--
-- Maintenant : toute clé étrangère vers auth.users qui bloque la suppression
-- (NO ACTION / RESTRICT) est recréée avec ON DELETE SET NULL - la colonne
-- (ex: "invité par") devient simplement vide au lieu de bloquer. Les clés
-- qui sont déjà en CASCADE ou SET NULL ne sont pas touchées.
--
-- Une colonne NOT NULL ne peut pas passer à SET NULL : elle est ignorée et
-- signalée dans les messages (onglet "Messages" du SQL Editor).
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select
      c.conrelid::regclass::text as tbl,
      c.conname,
      a.attname as col,
      a.attnotnull as notnull
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and c.confdeltype in ('a', 'r')
      and array_length(c.conkey, 1) = 1
  loop
    if r.notnull then
      raise notice 'IGNORÉ (colonne NOT NULL) : %.% (contrainte %)', r.tbl, r.col, r.conname;
      continue;
    end if;

    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete set null',
      r.tbl, r.conname, r.col
    );
    raise notice 'CORRIGÉ : %.%', r.tbl, r.col;
  end loop;
end $$;

-- ------------------------------------------------------------
-- Vérification (à lancer après) : doit ne retourner AUCUNE ligne, sauf les
-- colonnes NOT NULL signalées ci-dessus.
--
--   select conrelid::regclass as table_bloquante, conname
--   from pg_constraint
--   where contype = 'f'
--     and confrelid = 'auth.users'::regclass
--     and confdeltype in ('a', 'r');
-- ------------------------------------------------------------
