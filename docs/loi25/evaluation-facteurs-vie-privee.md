# Évaluation des facteurs relatifs à la vie privée (EFVP) - modèle

Document **interne** (pas public). La Loi 25 demande une EFVP avant de communiquer des renseignements personnels à l'extérieur du Québec, et pour tout nouveau projet qui traite des renseignements personnels. Ce modèle est un point de départ : à faire valider par une personne compétente. Mets-le à jour quand un fournisseur change.

**Date de l'évaluation :** 28 septembre 2026
**Faite par :** Guillaume (propriétaire)

## 1. Le traitement

- **Quoi :** Gozly, plateforme de gestion pour PME (horaire, pointage, inventaire, ventes, températures, discussion).
- **Renseignements en cause :** nom, courriel, téléphone, NIP, horaires, heures pointées, position GPS au pointage (si activé), messages, relevés de température, données de facturation.
- **Personnes concernées :** les clients (propriétaires de PME), leurs membres d'équipe, leurs employés.
- **Finalité :** offrir, sécuriser et facturer le service.

## 2. Fournisseurs et lieux de traitement

| Fournisseur | Rôle | Lieu (à confirmer) | Entente de traitement des données (DPA) | Fait ? |
|---|---|---|---|---|
| Supabase | Base de données, authentification | Canada (ca-central-1) | Intégrée à leurs Terms of Service (pas de démarche séparée - vérifié 2026-09-28) | ☑ |
| Vercel | Hébergement de l'application | États-Unis (région des fonctions à vérifier) | Intégrée à leurs Terms of Service (pas de démarche séparée - vérifié 2026-09-28) | ☑ |
| Stripe | Paiements | Canada / États-Unis | Intégrée à leur Services Agreement (pas de démarche séparée - stripe.com/legal/dpa, vérifié 2026-09-28) | ☑ |
| Wix / Nethris | Intégrations choisies par le client | À vérifier au besoin | À vérifier au besoin | ☐ |

## 3. Risques et mesures

| Risque | Mesure actuelle | À améliorer |
|---|---|---|
| Accès d'une entreprise aux données d'une autre | Règles de sécurité par ligne (RLS) dans Supabase, contrôles côté serveur | Test de permissions avec deux entreprises |
| Compte employé deviné (NIP à 4 chiffres) | Limite de tentatives de connexion | Envisager un NIP plus long |
| Fuite d'une clé secrète | Clés dans Vercel (jamais dans le code), clés de test séparées de la production | Rotation régulière |
| Perte de données | Sauvegardes du fournisseur | Confirmer la fréquence et la durée dans Supabase (Database > Backups) |
| Transfert hors Québec | Données principales au Canada (Supabase ca-central-1) ; traitements possibles aux États-Unis (Vercel, Stripe) ; DPA de ces 3 fournisseurs déjà en vigueur via leurs conditions générales (voir tableau ci-dessus) ; informé dans la Politique de confidentialité (fait) | Revérifier si un fournisseur change ou si Wix/Nethris deviennent pertinents |
| Accès GPS | Vérifié seulement au pointage, jamais en continu | - |

## 4. Conclusion

- Le niveau de risque est-il acceptable ?  **Oui**, pour un pilote gratuit avec un seul client. À revoir avant de vendre à plus de clients.
- Mesures à mettre en place avant de vendre :
  - Test de permissions avec deux entreprises de test (confirmer l'étanchéité RLS).
  - Confirmer la fréquence et la durée des sauvegardes du plan Supabase utilisé.
  - Faire réviser cette évaluation et les pages légales par un professionnel du droit.
- Prochaine révision : au moins 1 fois par an, ou dès qu'un fournisseur change (nouveau service connecté, changement de plan Supabase/Vercel/Stripe, etc.).

## Rappel

La Politique de confidentialité dit que Gozly évalue les risques et prévoit des protections contractuelles avant un transfert hors du Québec. Pour que cette phrase soit **vraie**, il faut avoir rempli ce document et accepté les DPA des fournisseurs ci-dessus.
