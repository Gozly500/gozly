-- Suivi des ventes : nom du terminal de paiement de l'entreprise (Moneris, Clover, Lightspeed...),
-- affiché dans la conciliation et les exports. Vide = « terminal de paiement ».
-- À exécuter dans Supabase > SQL Editor > New query > Run
alter table entreprises add column if not exists ventes_terminal_nom text;
