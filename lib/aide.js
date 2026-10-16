// Contenu du centre d'aide (/aide). Chaque catégorie a un id, un titre et des questions { q, r }.
// "r" est une liste de paragraphes. Les textes existent en français et en anglais.
// Pour ajouter une question : l'ajouter dans les deux langues, au même endroit.

export const AIDE_UI = {
  fr: {
    titre: "Centre d'aide",
    sousTitre: "Des réponses rapides aux questions qu'on nous pose le plus souvent.",
    recherche: "Cherche une question…",
    toutes: "Toutes",
    aucun: "Aucune réponse ne correspond à ta recherche.",
    aucunAide: "Essaie d'autres mots ou écris-nous, on va t'aider.",
    pasTrouve: "Tu n'as pas trouvé ta réponse?",
    ecrire: "Écris-nous à",
    contact: "ou passe par le formulaire de contact",
    statut: "Quelque chose ne fonctionne pas? Vérifie d'abord l'état des systèmes.",
    meta: "Gozly - Centre d'aide",
  },
  en: {
    titre: "Help center",
    sousTitre: "Quick answers to the questions we get asked the most.",
    recherche: "Search for a question…",
    toutes: "All",
    aucun: "No answer matches your search.",
    aucunAide: "Try other words or write to us, we'll help you out.",
    pasTrouve: "Didn't find your answer?",
    ecrire: "Write to us at",
    contact: "or use the contact form",
    statut: "Something not working? Check the system status first.",
    meta: "Gozly - Help center",
  },
};

export const AIDE = {
  fr: [
    {
      id: "demarrer",
      titre: "Pour commencer",
      questions: [
        {
          q: "Comment je crée mon compte et mon entreprise?",
          r: [
            "Clique sur « S'inscrire », crée ton compte avec ton courriel, puis suis les étapes de bienvenue: tu nommes ton entreprise, tu choisis ton forfait et tu actives tes premiers modules.",
            "Ta première entreprise est créée à l'inscription. Selon ton forfait, tu peux en avoir plusieurs, chacune avec son propre tableau de bord.",
          ],
        },
        {
          q: "J'ai oublié mon mot de passe, qu'est-ce que je fais?",
          r: [
            "Sur la page de connexion, clique sur « Mot de passe oublié » et entre ton courriel. Tu vas recevoir un lien pour en choisir un nouveau.",
            "Si le courriel n'arrive pas, regarde dans tes pourriels et vérifie que tu as écrit la même adresse que celle de ton compte.",
          ],
        },
        {
          q: "Comment je change la langue de Gozly?",
          r: [
            "Sur le site, utilise la bulle de langue près du menu ou dans le pied de page. Dans le tableau de bord, la langue se règle dans les paramètres de ton compte, et elle te suit sur tous tes appareils.",
          ],
        },
        {
          q: "Je peux changer les couleurs du tableau de bord?",
          r: ["Oui, dans les paramètres tu peux choisir parmi les thèmes offerts. Le choix s'applique à ton tableau de bord."],
        },
      ],
    },
    {
      id: "forfaits",
      titre: "Forfaits et paiement",
      questions: [
        {
          q: "Quelle est la différence entre les forfaits?",
          r: [
            "Les forfaits se distinguent par le nombre de modules que tu peux activer en même temps et le nombre d'entreprises que ton compte peut gérer: Opale (3 modules, 1 entreprise), Onyx (5 modules, 3 entreprises) et Crystal (tous les modules, 5 entreprises).",
          ],
        },
        {
          q: "Comment je change de forfait ou j'annule?",
          r: [
            "Dans les paramètres de ton compte, section abonnement. Tu peux changer de forfait ou annuler en tout temps. L'annulation prend effet à la fin de la période déjà payée.",
          ],
        },
        {
          q: "Pourquoi un module est bloqué ou grisé?",
          r: [
            "Si tu as plus de modules actifs que ton forfait le permet, les modules en trop sont suspendus. Choisis ceux que tu veux garder avec « Gérer les modules », ou passe à un forfait supérieur. Tes données restent intactes.",
          ],
        },
        {
          q: "Où je trouve mes factures?",
          r: ["Les paiements passent par Stripe. Tu reçois un reçu par courriel à chaque paiement, et tu peux gérer ton moyen de paiement depuis les paramètres de ton compte."],
        },
      ],
    },
    {
      id: "equipe",
      titre: "Équipe et application employé",
      questions: [
        {
          q: "Comment mes employés se connectent à l'application mobile?",
          r: [
            "Ils ouvrent la page « /moi » de Gozly sur leur téléphone et entrent le code de l'entreprise et leur NIP personnel. Pas besoin de compte courriel pour eux.",
            "Tu trouves le code de l'entreprise et tu gères les NIP depuis la gestion de l'équipe dans ton tableau de bord.",
          ],
        },
        {
          q: "Comment installer l'application sur le téléphone?",
          r: [
            "Sur l'écran de connexion de l'application employé, appuie sur le bouton d'installation. Sinon, dans le navigateur, utilise l'option « Ajouter à l'écran d'accueil ». L'icône de Gozly apparaît alors comme une vraie application.",
          ],
        },
        {
          q: "Un employé a oublié son NIP.",
          r: ["Dans la gestion de l'équipe, tu peux lui donner un nouveau NIP. Il pourra se reconnecter tout de suite avec."],
        },
        {
          q: "Comment inviter un membre de l'équipe qui a besoin du tableau de bord?",
          r: [
            "Envoie-lui une invitation depuis la gestion de l'équipe. Il reçoit un lien, crée son compte et rejoint l'entreprise. Tu peux régler ce qu'il a le droit de voir et de modifier avec les permissions.",
          ],
        },
      ],
    },
    {
      id: "horaire",
      titre: "Horaire et pointage",
      questions: [
        {
          q: "Un employé a oublié de pointer sa sortie.",
          r: [
            "Gozly ferme automatiquement un pointage resté ouvert, environ 1 h 30 après la fermeture de l'entreprise. L'heure de sortie devient l'heure de fermeture et le pointage est marqué d'un drapeau « oubli potentiel » pour que tu puisses le valider ou le corriger dans la feuille de temps.",
          ],
        },
        {
          q: "Comment je corrige une heure dans la feuille de temps?",
          r: ["Ouvre la feuille de temps, clique sur la ligne concernée et modifie l'heure d'entrée ou de sortie. La modification s'applique aux totaux tout de suite."],
        },
        {
          q: "Comment j'exporte les heures pour la paie?",
          r: ["Dans la feuille de temps, utilise le bouton d'exportation pour obtenir un fichier CSV que tu peux importer dans ton service de paie, comme Nethris."],
        },
        {
          q: "Comment fonctionnent les demandes de congé et d'échange de quart?",
          r: [
            "Les employés les envoient depuis l'application mobile, et tu les retrouves dans l'onglet « Demandes ». Les congés demandent toujours ton approbation. Les échanges de quart peuvent être automatiques ou manuels, selon ce que tu règles dans la personnalisation.",
          ],
        },
      ],
    },
    {
      id: "inventaire",
      titre: "Inventaire, ventes et températures",
      questions: [
        {
          q: "Comment je synchronise mon inventaire avec Wix?",
          r: [
            "Connecte ton site Wix depuis le module Inventaire, puis utilise le bouton de synchronisation pour importer tes produits. Les quantités peuvent aussi être renvoyées vers Wix, à la main ou automatiquement, selon ton réglage dans la personnalisation.",
            "Pour l'instant, Gozly met à jour les quantités sur Wix mais ne crée pas de nouveaux produits là-bas.",
          ],
        },
        {
          q: "Le suivi des ventes se connecte-t-il à Wix ou Moneris?",
          r: [
            "Pas encore: le suivi des ventes est un journal que tu remplis à la main (Wix, Moneris, comptant, autre), avec les totaux par semaine. La connexion automatique est prévue plus tard.",
          ],
        },
        {
          q: "À quoi sert le module Températures?",
          r: [
            "Il remplace tes feuilles papier pour le registre de températures (exigences du MAPAQ). Tes employés saisissent les relevés depuis l'application mobile, et tu peux exporter les fiches. Tu restes responsable de respecter les exigences qui s'appliquent à ton entreprise.",
          ],
        },
        {
          q: "Combien de temps mes données sont-elles conservées?",
          r: ["Certaines données, comme les fiches de température, sont supprimées automatiquement après le délai que tu choisis dans la personnalisation. Exporte ce que tu dois garder avant la suppression."],
        },
      ],
    },
    {
      id: "scattegories",
      titre: "Scattegories",
      questions: [
        {
          q: "Comment je fais jouer mes amis avec leur téléphone?",
          r: [
            "Va sur la page Scattegories et choisis « Maître du jeu ». Un code de 4 caractères s'affiche. Tes amis choisissent « Rejoindre », entrent le code et leur nom, et ils jouent sur leur propre téléphone.",
          ],
        },
        {
          q: "Rien n'est enregistré, c'est vrai?",
          r: ["Oui. Le jeu est gratuit, sans compte, et aucune donnée n'est stockée. Quand la partie finit, tout disparaît."],
        },
        {
          q: "Un joueur n'apparaît pas dans la liste.",
          r: ["Vérifie qu'il a bien entré le même code que celui affiché. S'il est déjà dedans, qu'il recharge la page et rejoigne à nouveau. Le réseau Wi-Fi d'un endroit public peut aussi bloquer la connexion: essaie avec les données mobiles."],
        },
      ],
    },
    {
      id: "probleme",
      titre: "Un problème?",
      questions: [
        {
          q: "Une page ne charge pas ou affiche une erreur.",
          r: [
            "Recharge la page, puis essaie de te déconnecter et de te reconnecter. Regarde aussi la page d'état des systèmes: si un service est en panne, c'est affiché là.",
          ],
        },
        {
          q: "Je ne vois pas les modifications que je viens de faire.",
          r: ["Recharge la page. Si ça persiste, vide le cache du navigateur ou ouvre Gozly dans une fenêtre privée pour voir si le problème vient de ton navigateur."],
        },
        {
          q: "Comment je supprime mon compte ou mes données?",
          r: [
            "Tu peux fermer ton compte en tout temps. Après la fermeture, tu as 30 jours pour exporter tes données, puis elles sont détruites. Pour toute demande liée à tes renseignements personnels, écris-nous.",
          ],
        },
      ],
    },
  ],
  en: [
    {
      id: "demarrer",
      titre: "Getting started",
      questions: [
        {
          q: "How do I create my account and my business?",
          r: [
            "Click \"Sign up\", create your account with your email, then follow the welcome steps: name your business, pick your plan and turn on your first modules.",
            "Your first business is created at sign-up. Depending on your plan you can have several, each with its own dashboard.",
          ],
        },
        {
          q: "I forgot my password, what do I do?",
          r: [
            "On the login page, click \"Forgot password\" and enter your email. You'll receive a link to choose a new one.",
            "If the email doesn't show up, check your spam folder and make sure you typed the same address as your account.",
          ],
        },
        {
          q: "How do I change the language of Gozly?",
          r: [
            "On the website, use the language bubble next to the menu or in the footer. In the dashboard, the language is set in your account settings, and it follows you on all your devices.",
          ],
        },
        {
          q: "Can I change the dashboard colours?",
          r: ["Yes, in the settings you can pick from the available themes. Your choice applies to your dashboard."],
        },
      ],
    },
    {
      id: "forfaits",
      titre: "Plans and billing",
      questions: [
        {
          q: "What's the difference between the plans?",
          r: [
            "Plans differ by how many modules you can have active at once and how many businesses your account can manage: Opale (3 modules, 1 business), Onyx (5 modules, 3 businesses) and Crystal (all modules, 5 businesses).",
          ],
        },
        {
          q: "How do I change my plan or cancel?",
          r: [
            "In your account settings, in the subscription section. You can change plans or cancel at any time. Cancellation takes effect at the end of the period you already paid for.",
          ],
        },
        {
          q: "Why is a module locked or greyed out?",
          r: [
            "If you have more active modules than your plan allows, the extra ones are suspended. Pick the ones you want to keep with \"Manage modules\", or upgrade your plan. Your data stays intact.",
          ],
        },
        {
          q: "Where do I find my invoices?",
          r: ["Payments go through Stripe. You get a receipt by email for each payment, and you can manage your payment method from your account settings."],
        },
      ],
    },
    {
      id: "equipe",
      titre: "Team and employee app",
      questions: [
        {
          q: "How do my employees log in to the mobile app?",
          r: [
            "They open the Gozly \"/moi\" page on their phone and enter the business code and their personal PIN. They don't need an email account.",
            "You'll find the business code and manage PINs from team management in your dashboard.",
          ],
        },
        {
          q: "How do I install the app on a phone?",
          r: [
            "On the employee app's login screen, tap the install button. Otherwise, use \"Add to home screen\" in the browser. The Gozly icon then shows up like a real app.",
          ],
        },
        {
          q: "An employee forgot their PIN.",
          r: ["In team management you can give them a new PIN. They can log back in with it right away."],
        },
        {
          q: "How do I invite a team member who needs the dashboard?",
          r: [
            "Send an invitation from team management. They receive a link, create their account and join the business. You can control what they can see and edit with permissions.",
          ],
        },
      ],
    },
    {
      id: "horaire",
      titre: "Schedule and time clock",
      questions: [
        {
          q: "An employee forgot to clock out.",
          r: [
            "Gozly automatically closes a clock-in that stayed open, about 1 h 30 after the business closes. The clock-out time becomes the closing time and the entry is flagged \"possible missed punch\" so you can validate or fix it in the timesheet.",
          ],
        },
        {
          q: "How do I fix an hour in the timesheet?",
          r: ["Open the timesheet, click the row and edit the clock-in or clock-out time. Totals update right away."],
        },
        {
          q: "How do I export hours for payroll?",
          r: ["In the timesheet, use the export button to get a CSV file you can import into your payroll service, such as Nethris."],
        },
        {
          q: "How do time-off and shift swap requests work?",
          r: [
            "Employees send them from the mobile app and you find them in the \"Requests\" tab. Time off always needs your approval. Shift swaps can be automatic or manual, depending on what you set in customization.",
          ],
        },
      ],
    },
    {
      id: "inventaire",
      titre: "Inventory, sales and temperatures",
      questions: [
        {
          q: "How do I sync my inventory with Wix?",
          r: [
            "Connect your Wix site from the Inventory module, then use the sync button to import your products. Quantities can also be sent back to Wix, manually or automatically, depending on your customization setting.",
            "For now, Gozly updates quantities on Wix but doesn't create new products there.",
          ],
        },
        {
          q: "Does sales tracking connect to Wix or Moneris?",
          r: [
            "Not yet: sales tracking is a journal you fill in by hand (Wix, Moneris, cash, other), with weekly totals. Automatic connection is planned for later.",
          ],
        },
        {
          q: "What is the Temperatures module for?",
          r: [
            "It replaces your paper sheets for the temperature log (MAPAQ requirements). Your employees enter readings from the mobile app and you can export the records. You remain responsible for meeting the requirements that apply to your business.",
          ],
        },
        {
          q: "How long is my data kept?",
          r: ["Some data, like temperature records, is deleted automatically after the delay you choose in customization. Export what you need to keep before it's deleted."],
        },
      ],
    },
    {
      id: "scattegories",
      titre: "Scattegories",
      questions: [
        {
          q: "How do I get my friends playing on their phones?",
          r: [
            "Go to the Scattegories page and pick \"Game master\". A 4-character code appears. Your friends pick \"Join\", enter the code and their name, and play on their own phone.",
          ],
        },
        {
          q: "Is it true nothing is saved?",
          r: ["Yes. The game is free, needs no account, and no data is stored. When the game ends, everything disappears."],
        },
        {
          q: "A player doesn't show up in the list.",
          r: ["Make sure they entered the same code as the one displayed. If they're already in, have them reload the page and join again. Public Wi-Fi can also block the connection: try mobile data."],
        },
      ],
    },
    {
      id: "probleme",
      titre: "Having a problem?",
      questions: [
        {
          q: "A page won't load or shows an error.",
          r: [
            "Reload the page, then try logging out and back in. Also check the system status page: if a service is down, it's shown there.",
          ],
        },
        {
          q: "I don't see the changes I just made.",
          r: ["Reload the page. If it persists, clear your browser cache or open Gozly in a private window to see whether the problem comes from your browser."],
        },
        {
          q: "How do I delete my account or my data?",
          r: [
            "You can close your account at any time. After closing, you have 30 days to export your data, then it's destroyed. For any request about your personal information, write to us.",
          ],
        },
      ],
    },
  ],
};
