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

## État du projet (mis à jour le 2026-11-17)

Modules actuels (`lib/modules.js`) : Planning, Horaire & Pointage, Inventaire,
Suivi des ventes, Températures (MAPAQ), Commandes en ligne (kiosque), Musique
(Sonos). Un nouveau module s'ajoute dans `lib/modules.js` (sidebar, limite de
forfait, popup de blocage) et un widget dans `lib/dashboardWidgets.js`.

### Intégrations

- **Wix** (app « Gozly connect ») : inventaire dans les deux sens (quantité
  seulement) et commandes. Deux types de commandes qui se gèrent différemment :
  **Wix Restaurants** (statuts Pending/Accepted/Ready/In_Delivery/Fulfilled) et
  **Wix Boutique** (aucun statut). Le type est détecté et stocké dans
  `commandes_en_ligne.type_wix` (`lib/statutsWix.js`, `lib/synchroCommandesWix.js`).
  Jamais de test d'écriture Wix sur de vraies commandes de clients.
- **Stripe** en production (forfait par compte). **Nethris** : export CSV manuel
  seulement. **Moneris** : jamais recherché (bloque la conciliation des ventes).
- **Connexions IA (MCP)**, **OneDrive** (export des fiches de température),
  **Discord** (bot Gozyx), **Sonos** (quota 20 000 demandes/jour par compte).

### Kiosque Commandes (`/kiosque`, composant `CommandesKioskContent.jsx`)

- Toute nouvelle commande arrive « En attente » (son en boucle + halo).
- Mode **Liste** : Restaurants = Accepter → Prête → (En livraison si livraison)
  → Terminer ; Boutique/manuelle = Traitée → Terminer. Option « Accepter saute
  directement à un statut » (`commandes_liste_sauter`).
- Mode **3 sections** : 2e = `commandes_traitee_wix`, 3e = `commandes_terminee_wix`.
  En mode Wix, les commandes Boutique sont cachées.
- **Verrouillage par NIP** (`lib/verrouNip.js`) : haché avec sel dans le
  localStorage de la tablette, marche hors connexion, 5 erreurs = pause de 30 s,
  verrouillage auto « jamais / à la fermeture / à une heure ».
- **Épinglage d'un kiosque** (`lib/kiosqueEpingle.js`) : armé depuis les
  réglages ; pour désépingler, quitter l'app et la rouvrir (borne Windows :
  redémarrer).
- Réglages du kiosque en catégories (`KiosqueReglages.jsx`, textes dans
  `lib/i18n/kiosque.js`). Clavier et calendrier Gozly actifs sur écran tactile,
  dans l'app Android et dans l'app Windows (`lib/saisieGozly.js`).

### Apps du kiosque (dépôt séparé `gozly-suite`, dossier `gozly-traitement-texte/`)

- **Android** (`kiosque-android/`, WebView, impression Bluetooth, build sur
  GitHub Actions, version 0.3.0 à installer sur la tablette).
- **Windows** (`kiosque-windows/`, Electron) : réglages de l'appareil depuis les
  Réglages du kiosque (volume, luminosité des écrans intégrés, Bluetooth avec
  recherche/jumelage, Wi-Fi, Paramètres Windows). Les paramètres Windows
  s'ouvrent seulement avec le code administrateur Gozly, vérifié côté serveur
  (`/api/kiosque/code-admin`). Publier une version : changer la version dans
  `package.json`, `npm run dist`, puis `gh release create kiosque-pc-vX` avec
  l'installeur, le `.blockmap` et `latest.yml`. Les kiosques se mettent à jour
  la nuit. Installeur non signé (SmartScreen).
- Les changements du site (kiosque, clavier, etc.) n'exigent PAS de mise à jour
  des apps : elles chargent gozly.net.

### Démo (`/demo`, code dans `lib/demo/`)

- Le bouton « Démo » de l'accueil ouvre `/demo`, puis le vrai tableau de bord branché sur une **fausse base qui vit dans le
  navigateur** (aucun serveur, rien chez Gozly). Tout est dans `sessionStorage` : fermer l'onglet efface la démo.
- `lib/supabaseClient.js` est un proxy : si le drapeau de démo est actif (`lib/demo/actif.js`), tous les appels vont vers le moteur
  `lib/demo/moteur.js` (mini PostgREST en mémoire) ; `fetch("/api/...")` est intercepté par `lib/demo/api.js`. Le code de la démo est
  chargé à la demande : les visiteurs normaux n'en téléchargent rien.
- Données de départ : `lib/demo/donnees.js` (entreprise fictive, 15 employés, OneDrive et Nethris « connectés »). Une nouvelle table
  ou colonne utilisée par un module = l'ajouter à ces données si on veut qu'elle soit remplie dans la démo.
- Pas dans la démo : app mobile `/moi`, paiements, Wix, Sonos (Commandes et Musique s'activent mais restent vides).

### Variables d'environnement à ne pas oublier

- `KIOSQUE_CODE_ADMIN` (Vercel) : code qui ouvre les Paramètres Windows depuis
  le kiosque. Pour le changer : modifier la valeur dans Vercel puis
  **redéployer** (une variable ne s'applique qu'aux nouveaux déploiements).
  Ne jamais l'écrire dans le code, le chat ou un endroit visible par les clients.

### Règles de travail

- Français québécois familier (« tu »), jamais le nom d'un client dans le code,
  l'interface ou le SQL.
- Jamais de `<select>` natif : utiliser le menu maison `.emplacement-select-*`.
- Toute nouvelle table/colonne = un fichier `.sql` dans `supabase/` à exécuter
  soi-même dans le SQL Editor (et le dire explicitement).
- Avant un push majeur : aperçu local à tester, regrouper les petits changements
  (les minutes de build Vercel coûtent). Lancer `next build` avant de pousser
  (les erreurs « Invalid URL » sur les icônes prérendues existaient déjà) puis
  supprimer `.next` avant de relancer le serveur de dev.
- Dates et heures affichées en heure du Québec (`lib/dates.js`).

### Fait / à faire

- Terminé : kiosque Android + Windows, NIP, épinglage, réglages Windows.
- À vérifier : installer l'app Android 0.3.0 sur la tablette, tester le son et
  l'impression d'une nouvelle commande avec le nouveau flux « En attente »,
  vérifier que l'ancien système d'impression par IP est bien retiré.
- Reporté : pages glissantes entre plateformes (attendre une 2e plateforme),
  Commandes du dashboard encore en 3 étapes, modification d'une commande Wix
  depuis Gozly, Shopify, signature de l'installeur Windows, app native Expo
  (jamais lancée sur un téléphone), conciliation Wix/Moneris.
