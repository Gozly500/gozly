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
      `Pour toute question sur la protection de vos renseignements personnels, ou pour joindre notre responsable de la protection des renseignements personnels : ${LEGAL.courrielContact}.`,
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
    titre: "Qui y a accès et avec qui nous les partageons",
    contenu: [
      "Au sein d'une entreprise, l'accès dépend des permissions données par l'administrateur (par exemple, un employé ne voit que ce que l'application mobile lui permet de voir). Les données d'une entreprise ne sont jamais visibles par une autre entreprise.",
      "Nous faisons appel à des fournisseurs de services pour faire fonctionner Gozly :",
      [
        "Supabase : hébergement de la base de données et authentification.",
        "Vercel : hébergement de l'application.",
        "Stripe : traitement des paiements et de l'abonnement.",
        "Wix, Nethris ou d'autres services : seulement si votre entreprise choisit de les connecter à Gozly.",
      ],
      "Ces fournisseurs peuvent traiter des données à l'extérieur du Québec, notamment aux États-Unis. Nous les choisissons pour leurs pratiques de sécurité, mais nous ne pouvons pas garantir que les lois de ces endroits offrent la même protection qu'au Québec.",
      "Nous pouvons aussi communiquer des renseignements si la loi ou une ordonnance d'un tribunal l'exige.",
    ],
  },
  {
    titre: "Durée de conservation",
    contenu: [
      "Nous conservons les renseignements aussi longtemps que le compte de l'entreprise est actif et que nécessaire pour offrir le service.",
      "Certaines données sont supprimées automatiquement selon un délai que l'entreprise peut régler dans Personnalisation, par exemple les fiches de température (3, 6 ou 12 mois) et les demandes de congé ou d'échange traitées. L'entreprise peut exporter ses données avant leur suppression.",
      "Quand une entreprise supprime son compte, ses données sont supprimées, sous réserve des copies de sauvegarde qui sont écrasées selon leur cycle normal et de ce que la loi nous oblige à conserver (par exemple, les documents de facturation).",
    ],
  },
  {
    titre: "Sécurité",
    contenu: [
      "Nous prenons des mesures raisonnables pour protéger vos renseignements : connexions chiffrées (HTTPS), séparation des données entre entreprises, contrôle d'accès, chiffrement des identifiants de services externes connectés (par exemple la paie) et limitation des tentatives de connexion.",
      "Aucun système n'est parfaitement sécuritaire. En cas d'incident de confidentialité présentant un risque de préjudice sérieux, nous aviserons les personnes concernées et la Commission d'accès à l'information du Québec, comme la loi l'exige.",
    ],
  },
  {
    titre: "Vos droits",
    contenu: [
      "Conformément à la Loi sur la protection des renseignements personnels dans le secteur privé (Loi 25), vous pouvez demander d'accéder aux renseignements que nous détenons sur vous, de les faire corriger, ou de demander leur suppression, sous réserve des exceptions prévues par la loi.",
      `Écrivez-nous à ${LEGAL.courrielContact}. Si vous êtes un employé d'une entreprise cliente, nous pourrions vous demander de vous adresser d'abord à votre employeur, qui est responsable de ces renseignements. Vous pouvez aussi déposer une plainte auprès de la Commission d'accès à l'information du Québec.`,
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
