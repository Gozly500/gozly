-- Permet de créer une entreprise sans forfait assigné (à choisir plus tard).
-- À exécuter dans Supabase > SQL Editor > New query > Run

alter table entreprises alter column forfait drop not null;
alter table entreprises alter column forfait drop default;
