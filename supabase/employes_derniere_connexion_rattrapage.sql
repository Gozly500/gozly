-- ============================================================
-- Rattrapage ponctuel (à exécuter une seule fois) : remplit
-- employes.derniere_connexion pour les sessions déjà actives avant
-- l'ajout de cette colonne (voir employes_derniere_connexion.sql),
-- à partir de employe_sessions.derniere_utilisation - sinon ces
-- employés semblent "n'avoir jamais ouvert l'application" alors qu'ils
-- l'utilisent déjà, le temps qu'ils refassent un appel.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

update employes e
set derniere_connexion = s.derniere
from (
  select employe_id, max(derniere_utilisation) as derniere
  from employe_sessions
  group by employe_id
) s
where s.employe_id = e.id
  and e.derniere_connexion is null;
