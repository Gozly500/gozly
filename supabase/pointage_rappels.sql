-- Rappel de pointage : notification « N'oublie pas de pointer » aux employés dont le quart a commencé
-- depuis 10 minutes sans pointage. Réglage dans Personnalisation > Pointage. Désactivé par défaut.
alter table entreprises add column if not exists pointage_rappels_actif boolean not null default false;
