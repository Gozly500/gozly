-- Libellé « Échange » sur l'horaire : le quart (ou le morceau de quart) reçu par un échange retient
-- l'employé qui l'a donné. Vide = quart normal.
alter table planning_quarts add column if not exists echange_de uuid references employes(id) on delete set null;
