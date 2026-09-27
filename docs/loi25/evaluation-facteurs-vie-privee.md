# Évaluation des facteurs relatifs à la vie privée (EFVP) - modèle

Document **interne** (pas public). La Loi 25 demande une EFVP avant de communiquer des renseignements personnels à l'extérieur du Québec, et pour tout nouveau projet qui traite des renseignements personnels. Ce modèle est un point de départ : à faire valider par une personne compétente. Mets-le à jour quand un fournisseur change.

**Date de l'évaluation :**
**Faite par :**

## 1. Le traitement

- **Quoi :** Gozly, plateforme de gestion pour PME (horaire, pointage, inventaire, ventes, températures, discussion).
- **Renseignements en cause :** nom, courriel, téléphone, NIP, horaires, heures pointées, position GPS au pointage (si activé), messages, relevés de température, données de facturation.
- **Personnes concernées :** les clients (propriétaires de PME), leurs membres d'équipe, leurs employés.
- **Finalité :** offrir, sécuriser et facturer le service.

## 2. Fournisseurs et lieux de traitement

| Fournisseur | Rôle | Lieu (à confirmer) | Entente de traitement des données (DPA) | Fait ? |
|---|---|---|---|---|
| Supabase | Base de données, authentification | Canada (ca-central-1) | Accepter/signer le DPA de Supabase | ☐ |
| Vercel | Hébergement de l'application | États-Unis (région des fonctions à vérifier) | Accepter le DPA de Vercel | ☐ |
| Stripe | Paiements | Canada / États-Unis | DPA de Stripe (inclus dans leurs conditions) | ☐ |
| Wix / Nethris | Intégrations choisies par le client | À vérifier au besoin | À vérifier au besoin | ☐ |

## 3. Risques et mesures

| Risque | Mesure actuelle | À améliorer |
|---|---|---|
| Accès d'une entreprise aux données d'une autre | Règles de sécurité par ligne (RLS) dans Supabase, contrôles côté serveur | Test de permissions avec deux entreprises |
| Compte employé deviné (NIP à 4 chiffres) | Limite de tentatives de connexion | Envisager un NIP plus long |
| Fuite d'une clé secrète | Clés dans Vercel (jamais dans le code), clés de test séparées de la production | Rotation régulière |
| Perte de données | Sauvegardes du fournisseur | Confirmer la fréquence et la durée dans Supabase (Database > Backups) |
| Transfert hors Québec | Données principales au Canada ; traitements possibles aux États-Unis | DPA signés, informer dans la Politique de confidentialité (fait) |
| Accès GPS | Vérifié seulement au pointage, jamais en continu | - |

## 4. Conclusion

- Le niveau de risque est-il acceptable ?  Oui / Non
- Mesures à mettre en place avant de vendre :
- Prochaine révision (au moins 1 fois par an, ou si un fournisseur change) :

## Rappel

La Politique de confidentialité dit que Gozly évalue les risques et prévoit des protections contractuelles avant un transfert hors du Québec. Pour que cette phrase soit **vraie**, il faut avoir rempli ce document et accepté les DPA des fournisseurs ci-dessus.
