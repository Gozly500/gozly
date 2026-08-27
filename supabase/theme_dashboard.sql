-- ============================================================
-- Ajout : thème du tableau de bord (Paramètres du compte > Apparence)
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- 'gozly' (défaut), 'vert' ou 'sombre' - voir lib/themes.js
alter table profils add column if not exists theme text not null default 'gozly';

-- Les GRANT/policy UPDATE sur profils existent déjà (supabase/parametres_compte.sql),
-- donc aucune permission supplémentaire n'est nécessaire ici.
