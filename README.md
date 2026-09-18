# Gozly - Guide de démarrage

Gozly est un SaaS modulaire pour PME (Next.js + Supabase + Vercel) : un
site vitrine public, un tableau de bord pour le proprio/l'équipe, et une
app mobile pour les employés (`/moi`). Voici comment le faire tourner et
le mettre en ligne, étape par étape.

## 1. Installer les outils de base (une seule fois)

- **Node.js** : télécharge-le sur https://nodejs.org (prends la version "LTS").
  Ça installe aussi `npm`, l'outil qui gère les dépendances du projet.
- **Un compte GitHub** (gratuit) : https://github.com - sert à stocker le code.
- **Un compte Vercel** (gratuit) : https://vercel.com - héberge le site, se
  connecte directement à ton compte GitHub.
- **Un compte Supabase** (gratuit) : https://supabase.com - héberge la base
  de données et les comptes utilisateurs.

## 2. Lancer le projet sur ton ordinateur

Ouvre un terminal dans le dossier du projet, puis :

```bash
npm install
npm run dev
```

Ouvre ensuite http://localhost:3000 dans ton navigateur - tu devrais voir le
site tourner en local.

## 3. Créer ton projet Supabase

1. Va sur https://supabase.com, crée un nouveau projet (choisis un mot de
   passe de base de données que tu notes quelque part).
2. Une fois le projet créé, va dans **SQL Editor** (menu de gauche).
3. Ouvre `supabase/schema.sql`, copie tout son contenu, colle-le dans
   l'éditeur SQL de Supabase, et clique **Run**. Ça crée les tables de base
   (entreprises, employés, planning, etc.)
4. Ouvre ensuite `supabase/service_role_grants.sql` et exécute-le aussi -
   sans ça, certaines routes serveur n'ont pas la permission d'écrire dans
   les tables même si elles utilisent la clé `service_role`.
5. **Chaque fonctionnalité ajoutée depuis a son propre fichier `.sql`** dans
   le dossier `supabase/` (une cinquantaine à ce jour - chat, permissions,
   pointage mobile, notifications, etc.). Pour repartir d'une base à jour,
   il faut tous les exécuter. Le plus simple : demande à Claude Code
   "quels fichiers `supabase/*.sql` n'ai-je pas encore exécutés ?" avec
   l'accès à ton projet Supabase, ou exécute-les un par un en cas de doute
   (ils sont tous écrits pour être rejouables sans danger - `if not exists`
   partout).
6. Va dans **Project Settings > API**. Tu y trouveras `Project URL` et la
   clé `anon public`.
7. Dans ce projet, copie le fichier `.env.local.example` en `.env.local`
   (même dossier) et remplis les valeurs - **`.env.local.example` liste et
   explique chaque variable nécessaire** (Supabase, Stripe, Wix, Nethris,
   notifications push, cron). Toutes ne sont pas indispensables pour un
   premier essai en local : au minimum, remplis les deux variables
   `NEXT_PUBLIC_SUPABASE_*` pour que le site démarre.

Ton `.env.local` ne doit **jamais** être partagé ou mis sur GitHub - il est
déjà exclu automatiquement (voir `.gitignore`).

## 4. Mettre le code sur GitHub

Dans le terminal, à la racine du projet :

```bash
git init
git add .
git commit -m "Premier envoi du projet Gozly"
```

Ensuite, crée un nouveau dépôt (repository) vide sur https://github.com/new,
puis suis les instructions que GitHub te donne pour y envoyer ce code
(quelques commandes `git remote add` et `git push` qu'ils te fournissent
directement sur la page).

## 5. Déployer sur Vercel

1. Va sur https://vercel.com et connecte-toi avec ton compte GitHub.
2. Clique **Add New > Project**, choisis le dépôt GitHub que tu viens de créer.
3. Vercel détecte automatiquement que c'est un projet Next.js - pas besoin de
   configuration particulière.
4. **Avant de cliquer "Deploy"**, ajoute tes variables d'environnement
   (section "Environment Variables") : les mêmes que dans ton `.env.local`
   (voir `.env.local.example` pour la liste complète et à quoi sert
   chacune). Sans certaines d'entre elles, les fonctionnalités
   correspondantes (paiements, Wix, notifications push, paie) restent
   simplement désactivées plutôt que de faire planter le site.
5. Clique **Deploy**. Après une minute ou deux, ton site est en ligne avec une
   adresse du genre `gozly.vercel.app`.

Une fois que t'as un nom de domaine à toi, tu pourras le connecter dans
Vercel (Project Settings > Domains) pour remplacer l'adresse `.vercel.app`.

**Aucune clé secrète ne doit jamais se retrouver dans le code ou dans un
composant `"use client"`** - seules trois variables sont volontairement
publiques (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, protégées respectivement par les règles RLS
de Supabase et par la nature même des clés VAPID). Tout le reste
(`STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WIX_APP_SECRET`, etc.)
n'est lu que dans des fichiers serveur (`app/api/**/route.js` ou des
fichiers `lib/` importés uniquement par ceux-ci), jamais envoyé au
navigateur.

## Structure du projet

```
app/
  page.js, s-abonner/, contact/, login/, inscription/  -> site public
  dashboard/                  -> tableau de bord (proprio/équipe), un
                                  dossier par module (horaire, inventaire,
                                  planning, temperature, entreprise/...)
  moi/                        -> app mobile employé (PWA), auth séparée
                                  (code d'entreprise + NIP, pas Supabase Auth)
  api/                        -> routes serveur : dashboard (Supabase Auth),
                                  employe-app/* (session employé), webhooks
                                  (stripe, wix), cron/*
  globals.css                 -> tout le style de l'app (un seul fichier)
components/
  entreprise/, horaire/, inventaire/, planning/, discussion/, settings/...
  -> composants du dashboard, organisés par module
  moi/                        -> composants de l'app mobile employé
lib/
  supabaseClient.js           -> client Supabase côté navigateur (anon key)
  adminServer.js               -> client Supabase côté serveur (service_role)
  employeSession.js            -> vérification des sessions employé (/moi)
  pushServer.js                -> envoi des notifications push
  stripeServer.js, wixClient.js, nethrisClient.js -> intégrations tierces
supabase/
  schema.sql                   -> tables de base, à exécuter en premier
  *.sql                        -> une migration par fonctionnalité ajoutée
                                   depuis, à exécuter dans l'ordre
```

## Modules

Chaque module s'active/désactive par entreprise et s'enregistre dans
`lib/modules.js` : **Planning** (tâches par journée), **Horaire &
Pointage** (quarts de travail, kiosque de pointage physique NIP + pointage
mobile GPS optionnel), **Inventaire** (suivi de stock, sync Wix
optionnelle) et **Suivi des ventes** (journal manuel multi-sources).

L'app mobile employé (`/moi`) donne accès à l'horaire, aux demandes
(congés/échanges de quart), à la discussion d'équipe, aux tâches et
températures (selon les modules actifs), avec notifications push
configurables et plusieurs thèmes visuels.
