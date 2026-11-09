-- ============================================================
-- Connexions IA, partie 3 : droits par module (Horaire, Planning, Inventaire, Ventes).
-- Chaque connexion choisit, module par module : aucun accès, lecture, ou lecture + écriture (là où l'écriture existe).
-- À exécuter APRÈS supabase/ia_connexions.sql et supabase/ia_oauth.sql.
--
-- droits : {"horaire":"ecriture","planning":"lecture","inventaire":"aucun","ventes":"aucun"}
-- NULL (connexions créées avant) = ancien comportement : horaire en lecture, ou en écriture si ia_cles.ecriture = true.
-- ============================================================

alter table ia_cles add column if not exists droits jsonb;
alter table ia_oauth_codes add column if not exists droits jsonb;
