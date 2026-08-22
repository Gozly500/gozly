-- ============================================================
-- Un propriétaire ne peut jamais quitter son propre dashboard (seule la
-- suppression de compte, depuis Paramètres, peut y mettre fin). Un
-- membre simple peut toujours se retirer lui-même. Complète la
-- vérification déjà faite côté interface - celle-ci est la vraie
-- barrière de sécurité.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

drop policy if exists "Un propriétaire peut retirer un membre, ou un membre peut se retirer lui-même" on membres;
drop policy if exists "Un propriétaire peut retirer un membre, ou un membre peut se retirer lui-même (sauf le dernier propriétaire)" on membres;
create policy "Un propriétaire peut retirer un membre, ou un membre non-propriétaire peut se retirer lui-même"
on membres for delete
to authenticated
using (
  (user_id = auth.uid() and role <> 'proprietaire')
  or (user_id <> auth.uid() and est_proprietaire(entreprise_id))
);
