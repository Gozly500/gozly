import LegalPage from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Gozly - Conditions d'utilisation",
};

const sections = [
  {
    titre: "Acceptation",
    contenu: [
      `En créant un compte ou en utilisant Gozly (${LEGAL.siteUrl}), vous acceptez les présentes conditions ainsi que notre Politique de confidentialité. Si vous utilisez Gozly au nom d'une entreprise, vous confirmez avoir l'autorité pour l'engager. Si vous n'êtes pas d'accord, n'utilisez pas le service.`,
    ],
  },
  {
    titre: "Le service",
    contenu: [
      "Gozly est une plateforme modulaire de gestion pour petites et moyennes entreprises (par exemple : planning, horaire et pointage, inventaire, suivi des ventes, registre de températures, discussion d'équipe). Les modules disponibles dépendent du forfait choisi.",
      "Nous améliorons Gozly en continu : des fonctions peuvent être ajoutées, modifiées ou retirées. Nous ferons des efforts raisonnables pour aviser les clients de tout changement majeur.",
    ],
  },
  {
    titre: "Compte et accès",
    contenu: [
      "Vous devez fournir des renseignements exacts et garder vos identifiants confidentiels. Vous êtes responsable de l'activité faite avec votre compte, y compris celle des employés et membres d'équipe que vous invitez ou à qui vous donnez un code d'accès et un NIP.",
      "Prévenez-nous rapidement si vous soupçonnez un accès non autorisé.",
    ],
  },
  {
    titre: "Forfaits, prix et paiement",
    contenu: [
      "Gozly est offert sur abonnement mensuel (forfaits Opale, Onyx et Crystal, qui déterminent notamment le nombre de modules actifs). Le paiement est traité par Stripe et l'abonnement se renouvelle automatiquement jusqu'à son annulation.",
      "Les prix affichés sont indiqués avant taxes, s'il y a lieu; les taxes applicables sont ajoutées à la facture.",
      "Vous pouvez changer de forfait ou annuler en tout temps depuis les paramètres de votre compte. L'annulation prend effet à la fin de la période déjà payée; sauf disposition contraire de la loi, les montants déjà payés ne sont pas remboursés. Si votre nombre de modules dépasse la limite de votre forfait, l'accès aux modules excédentaires peut être suspendu jusqu'à ce que vous ajustiez votre sélection ou votre forfait.",
      "Nous pouvons modifier nos prix en vous avisant à l'avance; le nouveau prix s'applique à la prochaine période de facturation.",
    ],
  },
  {
    titre: "Vos données",
    contenu: [
      "Vous demeurez propriétaire des données que vous saisissez dans Gozly (« vos données »). Vous nous donnez le droit de les héberger et de les traiter uniquement pour vous offrir le service, comme décrit dans la Politique de confidentialité.",
      "En tant qu'entreprise cliente, vous êtes responsable d'avoir le droit de saisir les renseignements de vos employés et clients dans Gozly et de les informer, au besoin, de la manière dont ils sont utilisés.",
      "Vous pouvez exporter vos données (par exemple les fiches de température et la feuille de temps). Certaines données sont supprimées automatiquement après le délai que vous choisissez dans Personnalisation : il vous appartient d'exporter ce que vous devez conserver.",
    ],
  },
  {
    titre: "Registres de conformité (températures, etc.)",
    contenu: [
      "Gozly sert d'outil pour tenir vos registres, notamment le registre de températures. Il vous revient de vous assurer que vos pratiques et vos registres respectent les exigences légales qui s'appliquent à votre entreprise (par exemple celles du MAPAQ). Gozly ne remplace pas votre jugement ni vos obligations réglementaires.",
    ],
  },
  {
    titre: "Utilisation acceptable",
    contenu: [
      "Vous vous engagez à ne pas :",
      [
        "utiliser Gozly de façon illégale ou pour porter atteinte aux droits d'autrui;",
        "tenter d'accéder aux données d'une autre entreprise ou de contourner les mesures de sécurité;",
        "perturber le service (attaques, envoi massif de requêtes, etc.);",
        "revendre ou sous-licencier l'accès à Gozly sans notre accord écrit.",
      ],
      "Nous pouvons suspendre ou fermer un compte qui enfreint ces règles.",
    ],
  },
  {
    titre: "Services de tiers",
    contenu: [
      "Gozly peut se connecter à des services externes que vous choisissez (par exemple Wix ou un service de paie). Leur fonctionnement et leurs conditions relèvent de ces tiers; nous ne sommes pas responsables de leurs interruptions ou de leurs changements.",
    ],
  },
  {
    titre: "Disponibilité et garanties",
    contenu: [
      "Nous faisons des efforts raisonnables pour que Gozly soit disponible et fiable, mais nous ne garantissons pas un service sans interruption ni sans erreur. Des interruptions, pour maintenance ou pour des raisons hors de notre contrôle, peuvent survenir.",
      "Le service est fourni « tel quel » dans la mesure permise par la loi. Les droits qui ne peuvent être écartés par contrat, notamment ceux des lois de protection du consommateur lorsqu'elles s'appliquent, demeurent inchangés.",
    ],
  },
  {
    titre: "Limite de responsabilité",
    contenu: [
      "Dans la mesure permise par la loi, Gozly n'est pas responsable des dommages indirects (perte de profits, d'occasions d'affaires ou de données résultant de vos propres choix, par exemple de ne pas avoir exporté vos données à temps). Notre responsabilité totale envers vous, pour toute réclamation liée au service, est limitée aux montants que vous avez payés à Gozly au cours des 12 mois précédant l'événement.",
      "Cette limite ne s'applique pas à une faute lourde ou intentionnelle de notre part, ni dans les cas où la loi ne permet pas de limiter la responsabilité.",
    ],
  },
  {
    titre: "Fin du service",
    contenu: [
      "Vous pouvez fermer votre compte en tout temps. Nous pouvons suspendre ou mettre fin à l'accès en cas de non-paiement ou de violation des présentes conditions, en vous avisant quand c'est raisonnablement possible. Après la fermeture, vos données sont traitées selon la Politique de confidentialité.",
    ],
  },
  {
    titre: "Modifications, droit applicable et contact",
    contenu: [
      "Nous pouvons modifier ces conditions; nous aviserons les clients des changements importants, et continuer à utiliser Gozly après l'entrée en vigueur d'un changement vaut acceptation.",
      "Ces conditions sont régies par les lois du Québec et du Canada qui s'y appliquent. Tout litige relève des tribunaux compétents du Québec.",
      `Questions : ${LEGAL.courrielContact}.`,
    ],
  },
];

export default function ConditionsPage() {
  return (
    <LegalPage
      titre="Conditions d'utilisation"
      intro="Ces conditions encadrent l'utilisation de Gozly. Lisez-les attentivement : elles s'appliquent dès que vous créez un compte ou utilisez le service."
      sections={sections}
    />
  );
}
