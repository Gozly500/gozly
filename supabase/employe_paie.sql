-- Calculateur de paie (app employé /moi) : taux horaire confidentiel de chaque employé.
--
-- Une ligne = le calculateur est ACTIVÉ pour cet employé (taux_horaire peut être vide tant qu'il n'est pas entré).
-- Pas de ligne = désactivé (c'est le cas par défaut) : rien n'est stocké. Désactiver le calculateur supprime la ligne,
-- donc le taux est effacé ; le réactiver crée une nouvelle ligne.
--
-- Confidentialité : RLS activé SANS aucune politique -> personne ne peut lire cette table avec une session
-- Supabase normale (ni les gestionnaires, ni les autres employés). Seule la route /api/employe-app/paie la lit
-- (clé service_role), après avoir vérifié la session de l'employé concerné.

create table if not exists employe_paie (
  employe_id uuid primary key references employes(id) on delete cascade,
  taux_horaire numeric(8,2) check (taux_horaire is null or (taux_horaire > 0 and taux_horaire <= 1000)),
  created_at timestamptz not null default now()
);

alter table employe_paie enable row level security;

-- service_role contourne RLS mais a quand même besoin des privilèges sur la table.
grant select, insert, update, delete on employe_paie to service_role;
