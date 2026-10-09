-- Échange de quart proposé depuis une discussion : le message pointe vers la demande, et la
-- conversation affiche une carte avec les boutons Accepter / Refuser.
-- Une seule colonne ; si la demande est effacée, il reste un simple message texte.
alter table messages add column if not exists demande_echange_id uuid references demandes_echange(id) on delete set null;
