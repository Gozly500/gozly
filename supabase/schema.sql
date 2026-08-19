-- ============================================================
-- Schéma de base Gozly - structure multi-entreprise
-- ============================================================
-- Idée centrale : chaque table de données "métier" a une colonne
-- entreprise_id. Même si aujourd'hui il n'y a qu'une seule entreprise
-- (ex. Pasta Deliziosa) dans le système, cette colonne fait qu'on
-- n'a jamais besoin de réécrire les tables quand on ajoute un
-- deuxième client plus tard.
--
-- Comment l'exécuter :
-- 1. Va dans ton projet Supabase > SQL Editor
-- 2. Colle tout ce fichier
-- 3. Clique "Run"
-- ============================================================

-- Table des entreprises clientes (chaque client de Gozly = une ligne ici)
create table if not exists entreprises (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  forfait text not null default 'opale', -- 'opale' | 'onyx' | 'crystal'
  created_at timestamptz not null default now()
);

-- Table des employés, liés à une entreprise
create table if not exists employes (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  nom text not null,
  role text, -- ex: 'admin', 'employe'
  created_at timestamptz not null default now()
);

-- Exemple de module : planning
create table if not exists planning_quarts (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  employe_id uuid references employes(id) on delete set null,
  date date not null,
  heure_debut time not null,
  heure_fin time not null,
  created_at timestamptz not null default now()
);

-- Exemple de module : pointage
create table if not exists pointages (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references entreprises(id) on delete cascade,
  employe_id uuid not null references employes(id) on delete cascade,
  entree timestamptz not null,
  sortie timestamptz,
  created_at timestamptz not null default now()
);

-- Exemple de module : messages reçus via le formulaire de contact
create table if not exists messages_contact (
  id uuid primary key default gen_random_uuid(),
  nom text,
  courriel text not null,
  objet text,
  message text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Prochaines tables à ajouter au fur et à mesure (inventaire,
-- ventes, etc.) - toujours avec une colonne entreprise_id.
-- ============================================================
