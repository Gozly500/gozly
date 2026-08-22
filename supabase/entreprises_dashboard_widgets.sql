-- ============================================================
-- Ajout : configuration du tableau de bord personnalisable (ordre et
-- visibilité des widgets - raccourcis de modules, "Planning du jour",
-- "Équipe d'aujourd'hui", etc.). null = configuration par défaut du
-- registre (voir lib/dashboardWidgets.js), tout visible.
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

alter table entreprises add column if not exists dashboard_widgets jsonb;
