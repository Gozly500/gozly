# Gozly - Guide de démarrage

Ce projet contient le vrai code du site Gozly (vitrine + base pour le futur
dashboard), construit avec Next.js. Voici comment le faire tourner et le
mettre en ligne, étape par étape.

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
3. Ouvre le fichier `supabase/schema.sql` de ce projet, copie tout son
   contenu, colle-le dans l'éditeur SQL de Supabase, et clique **Run**.
   Ça crée toutes les tables de base (entreprises, employés, planning, etc.)
4. Va dans **Project Settings > API**. Tu y trouveras deux valeurs :
   - `Project URL`
   - `anon public` key
5. Dans ce projet, copie le fichier `.env.local.example` en `.env.local`
   (même dossier), et colle ces deux valeurs dedans.

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
4. **Avant de cliquer "Deploy"**, ajoute tes variables d'environnement (section
   "Environment Variables") : les mêmes `NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` que dans ton `.env.local`.
5. Clique **Deploy**. Après une minute ou deux, ton site est en ligne avec une
   adresse du genre `gozly.vercel.app`.

Une fois que t'as un nom de domaine à toi, tu pourras le connecter dans
Vercel (Project Settings > Domains) pour remplacer l'adresse `.vercel.app`.

## Structure du projet

```
app/
  page.js              -> page d'accueil (/)
  s-abonner/page.js     -> page tarifs (/s-abonner)
  contact/page.js       -> page contact (/contact)
  layout.js             -> structure commune à toutes les pages (polices, etc.)
  globals.css            -> tout le style du site
components/
  Nav.jsx               -> barre de navigation (utilisée sur toutes les pages)
  Footer.jsx             -> pied de page
  Loader.jsx             -> écran de chargement
  ContactForm.jsx        -> formulaire de la page contact
  TiltCard.jsx            -> effet de survol des cartes de tarifs
lib/
  supabaseClient.js       -> connexion à Supabase, utilisée partout où on a
                             besoin de lire/écrire des données
supabase/
  schema.sql              -> les tables de la base de données à exécuter
                             dans Supabase (voir étape 3 ci-dessus)
```

## Prochaine étape

Une fois que le site est en ligne, l'étape suivante est de construire le
dashboard (l'espace connecté avec le système de compte), puis le premier
module (planning) pour Pasta Deliziosa.
