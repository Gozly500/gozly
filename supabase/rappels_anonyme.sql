-- Rappels anonymes : un employé peut créer un rappel sans que les destinataires voient son nom. Le propriétaire
-- (dashboard > Discussion > + Nouveau > Rappel) voit toujours qui l'a créé. À exécuter après rappels.sql.
alter table rappels add column if not exists anonyme boolean not null default false;
