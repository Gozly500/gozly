-- ============================================================
-- Correction : n'importe quel membre pouvait retirer n'importe qui de
-- l'équipe, y compris le propriétaire. Seul un propriétaire peut
-- maintenant retirer quelqu'un d'autre (se retirer soi-même reste
-- toujours permis, peu importe le rôle).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

create or replace function est_proprietaire(p_entreprise_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from membres
    where entreprise_id = p_entreprise_id and user_id = auth.uid() and role = 'proprietaire'
  );
$$;

grant execute on function est_proprietaire(uuid) to authenticated;

drop policy if exists "Un membre peut retirer un autre membre de son entreprise" on membres;
drop policy if exists "Un propriétaire peut retirer un membre, ou un membre peut se retirer lui-même" on membres;
create policy "Un propriétaire peut retirer un membre, ou un membre peut se retirer lui-même"
on membres for delete
to authenticated
using (user_id = auth.uid() or est_proprietaire(entreprise_id));
