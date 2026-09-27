import LegalPage from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Gozly - Politique de confidentialité",
};

const sections = [
  {
    titre: "Qui est responsable de vos renseignements",
    contenu: [
      `${LEGAL.nomLegal} (« Gozly », « nous ») exploite la plateforme accessible à ${LEGAL.siteUrl}, un ensemble d'outils de gestion pour les petites et moyennes entreprises (horaire, pointage, inventaire, suivi des ventes, registre de températures, discussion d'équipe, etc.).`,
      "Nous agissons à titre de responsable des renseignements personnels de nos clients (les entreprises qui s'abonnent) et de leurs utilisateurs. Pour les renseignements de leurs employés que les entreprises saisissent dans Gozly, l'entreprise cliente demeure responsable de leur collecte et de leur utilisation, et Gozly les héberge et les traite pour son compte.",
      `Pour toute question sur la protection de vos renseignements personnels, ou pour joindre notre responsable de la protection des renseignements personnels : ${LEGAL.courrielConfidentialite}.`,
    ],
  },
  {
    titre: "Renseignements que nous recueillons",
    contenu: [
      "Selon les modules que votre entreprise utilise, Gozly peut contenir :",
      [
        "Compte : nom, courriel, mot de passe (stocké de façon sécurisée), nom de l'entreprise, forfait.",
        "Employés : nom, courriel ou téléphone, numéro d'employé, NIP de connexion à l'application mobile, succursale(s) assignée(s), horaire, quarts de travail, demandes de congé et d'échange de quart.",
        "Pointage : heures d'arrivée et de départ. Si l'entreprise active le pointage mobile, la position GPS de l'appareil est vérifiée au moment du pointage pour confirmer que la personne est à la succursale; nous ne suivons pas vos déplacements en continu.",
        "Registre de températures : relevés de température, équipement, date, créneau (AM/PM) et nom de la personne ayant fait le relevé.",
        "Inventaire et ventes : produits, quantités, ventes saisies, et données provenant des services que l'entreprise choisit de connecter (par exemple Wix).",
        "Discussion d'équipe : messages échangés entre les membres d'une même entreprise.",
        "Paiement : les informations de carte sont saisies directement chez notre processeur de paiement (Stripe). Gozly ne voit ni ne conserve votre numéro de carte complet.",
        "Données techniques : abonnement aux notifications, journaux techniques nécessaires au bon fonctionnement et à la sécurité du service.",
      ],
    ],
  },
  {
    titre: "Pourquoi nous les utilisons",
    contenu: [
      "Nous utilisons ces renseignements uniquement pour offrir, sécuriser et améliorer le service : faire fonctionner les modules, authentifier les utilisateurs, envoyer les notifications demandées, facturer l'abonnement et répondre à vos demandes de soutien.",
      "Nous ne vendons pas vos renseignements personnels et ne les utilisons pas à des fins publicitaires.",
    ],
  },
  {
    titre: "Qui y a accès et où ils sont hébergés",
    contenu: [
      "Au sein d'une entreprise, l'accès dépend des permissions données par l'administrateur (par exemple, un employé ne voit que ce que l'application mobile lui permet de voir). Les données d'une entreprise ne sont jamais visibles par une autre entreprise.",
      "Nous faisons appel à des fournisseurs de services pour faire fonctionner Gozly :",
      [
        "Supabase : base de données et authentification. Les données sont hébergées au Canada (région Canada centrale).",
        "Vercel : hébergement de l'application. Certains traitements peuvent avoir lieu aux États-Unis.",
        "Stripe : traitement des paiements et de l'abonnement, principalement au Canada et aux États-Unis.",
        "Wix, Nethris ou d'autres services : seulement si votre entreprise choisit de les connecter à Gozly.",
      ],
      "Certains de ces fournisseurs sont établis aux États-Unis ou y traitent des données, et pourraient y être soumis à des lois différentes de celles du Québec. Avant de confier des renseignements personnels à un fournisseur, ou de les transférer hors du Québec, nous évaluons les risques pour la vie privée et prévoyons, lorsque c'est requis, des protections contractuelles (ententes de traitement des données) avec ce fournisseur.",
      "Nous pouvons aussi communiquer des renseignements si la loi ou une ordonnance d'un tribunal l'exige.",
    ],
  },
  {
    titre: "Durée de conservation et destruction",
    contenu: [
      "Nous conservons les renseignements seulement le temps nécessaire aux fins pour lesquelles ils ont été recueillis, puis nous les détruisons. En pratique :",
      [
        "Données du compte et des modules : tant que le compte de l'entreprise est actif. Certaines données sont supprimées automatiquement selon un délai que l'entreprise règle dans Personnalisation (par exemple les fiches de température : 3, 6 ou 12 mois; les demandes de congé et d'échange traitées).",
        `Après la fermeture d'un compte : ${LEGAL.delaiExportApresFermetureJours} jours pour exporter les données, puis destruction dans les ${LEGAL.delaiSuppressionApresExportJours} jours suivants.`,
        `Facturation et paiements : ${LEGAL.conservationFacturationAnnees} ans, comme l'exigent les lois fiscales pour les registres comptables.`,
        "Copies de sauvegarde : elles sont écrasées selon le cycle normal de notre fournisseur, ce qui peut retarder de quelques semaines la disparition complète d'une donnée supprimée.",
        "Journaux techniques : conservés pour une durée limitée, selon les réglages de nos fournisseurs, uniquement pour la sécurité et le dépannage.",
      ],
      "L'entreprise cliente peut exporter ses données avant leur suppression.",
    ],
  },
  {
    titre: "Sécurité et incidents de confidentialité",
    contenu: [
      "Nous prenons des mesures raisonnables pour protéger vos renseignements : connexions chiffrées (HTTPS), séparation des données entre entreprises, contrôle d'accès, chiffrement des identifiants de services externes connectés (par exemple la paie) et limitation des tentatives de connexion.",
      "Aucun système n'est parfaitement sécuritaire. Nous tenons un registre des incidents de confidentialité, comme la loi l'exige. En cas d'incident présentant un risque de préjudice sérieux, nous aviserons les personnes concernées et la Commission d'accès à l'information du Québec.",
    ],
  },
  {
    titre: "Vos droits",
    contenu: [
      "Conformément à la Loi sur la protection des renseignements personnels dans le secteur privé (Loi 25), vous pouvez demander d'accéder aux renseignements que nous détenons sur vous, de les faire corriger, de retirer votre consentement ou de demander leur suppression, sous réserve des exceptions prévues par la loi (par exemple, ce que nous devons conserver à des fins de facturation).",
      `Écrivez-nous à ${LEGAL.courrielConfidentialite}. Nous répondons dans les 30 jours. Si vous êtes un employé d'une entreprise cliente, nous pourrions vous demander de vous adresser d'abord à votre employeur, qui est responsable de ces renseignements. Vous pouvez aussi déposer une plainte auprès de la Commission d'accès à l'information du Québec.`,
    ],
  },
  {
    titre: "Âge minimal",
    contenu: [
      "Gozly s'adresse aux entreprises : le compte doit être créé par une personne majeure. L'entreprise qui inscrit des employés de moins de 14 ans dans Gozly est responsable d'obtenir, au préalable, le consentement du parent ou du tuteur, comme l'exige la loi.",
    ],
  },
  {
    titre: "Témoins (cookies) et stockage local",
    contenu: [
      "Gozly utilise le stockage de votre navigateur uniquement pour garder votre session ouverte et retenir vos préférences (par exemple le thème). Nous n'utilisons pas de témoins publicitaires ni de suivi par des tiers.",
    ],
  },
  {
    titre: "Modifications de cette politique",
    contenu: [
      "Nous pouvons mettre à jour cette politique. La date de dernière mise à jour figure en haut de la page, et nous aviserons les clients des changements importants.",
    ],
  },
];

export default function ConfidentialitePage() {
  return (
    <LegalPage
      titre="Politique de confidentialité"
      intro="Cette politique explique quels renseignements personnels Gozly recueille, pourquoi, avec qui ils sont partagés et comment exercer vos droits."
      sections={sections}
    />
  );
}
