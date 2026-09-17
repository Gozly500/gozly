-- ============================================================
-- Ajout : pointage mobile (GPS) depuis l'app employé (/moi), en
-- complément du kiosque physique (NIP).
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- ============================================================

-- Interrupteur global (Personnalisation > Horaire & Pointage). Désactivé
-- par défaut : le bloc de pointage n'apparaît sur l'accueil de l'app
-- employé que si le proprio l'active explicitement.
alter table entreprises add column if not exists pointage_mobile_actif boolean not null default false;

-- Adresse + coordonnées GPS d'une succursale (géocodées automatiquement
-- depuis l'adresse tapée dans Emplacements - voir EmplacementsSection.jsx).
-- Tant qu'une succursale n'a pas de latitude/longitude, le pointage
-- mobile n'est simplement pas proposé aux employés qui y sont assignés
-- (aucune fonctionnalité existante n'est affectée par ces colonnes
-- nullables).
alter table emplacements add column if not exists adresse text;
alter table emplacements add column if not exists latitude double precision;
alter table emplacements add column if not exists longitude double precision;

-- Distingue un pointage fait au kiosque physique (comportement actuel,
-- valeur par défaut) d'un pointage fait depuis l'app mobile, et garde la
-- position GPS soumise à ce moment-là (nullable - jamais rempli pour un
-- pointage kiosque).
alter table pointages add column if not exists source text not null default 'kiosque';
alter table pointages add column if not exists latitude double precision;
alter table pointages add column if not exists longitude double precision;
