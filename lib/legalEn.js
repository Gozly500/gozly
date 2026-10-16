// Version anglaise (traduction de courtoisie) des Conditions d'utilisation et de la Politique de
// confidentialité. La version française prévaut en cas de divergence (voir la section finale des
// conditions et l'avis affiché sur la page). À FAIRE RELIRE par un professionnel du droit, comme la
// version française. Si le texte français change, mettre à jour celui-ci aussi.
import { LEGAL } from "@/lib/legal";

export const CONDITIONS_EN = {
  titre: "Terms of use",
  intro:
    "These terms govern the use of Gozly. Please read them carefully: they apply as soon as you create an account or use the service.",
  sections: [
    {
      titre: "Acceptance",
      contenu: [
        `By creating an account or using Gozly (${LEGAL.siteUrl}), you accept these terms as well as our Privacy Policy. If you use Gozly on behalf of a business, you confirm that you have the authority to bind it. If you do not agree, do not use the service.`,
        "Gozly is intended for businesses. The account must be created by an adult who has the authority to bind the business.",
      ],
    },
    {
      titre: "The service",
      contenu: [
        "Gozly is a modular management platform for small and medium-sized businesses (for example: planning, schedule and time clock, inventory, sales tracking, temperature log, team chat). The modules available depend on the plan chosen.",
        "We improve Gozly continuously: features may be added, changed or removed. We will make reasonable efforts to notify customers of any major change.",
      ],
    },
    {
      titre: "Account and access",
      contenu: [
        "You must provide accurate information and keep your credentials confidential. You are responsible for the activity carried out with your account, including that of the employees and team members you invite or to whom you give an access code and PIN.",
        "Notify us promptly if you suspect unauthorized access.",
      ],
    },
    {
      titre: "Plans, prices and payment",
      contenu: [
        "Gozly is offered on a monthly subscription (the Opale, Onyx and Crystal plans, which determine, among other things, the number of active modules). Payment is processed by Stripe and the subscription renews automatically until cancelled.",
        "Prices shown are before taxes, where applicable; applicable taxes are added to the invoice.",
        "You can change plans or cancel at any time from your account settings. Cancellation takes effect at the end of the period already paid; unless the law provides otherwise, amounts already paid are not refunded. If your number of modules exceeds your plan's limit, access to the excess modules may be suspended until you adjust your selection or your plan.",
        "We may change our prices by giving you at least 30 days' notice; the new price applies to the next billing period, and you may cancel before it takes effect.",
      ],
    },
    {
      titre: "Intellectual property",
      contenu: [
        "Gozly, as well as its platform, code, design, trademarks, name and logos, remain the property of Gozly. These terms do not transfer any ownership rights in these elements to you.",
        "For the duration of your subscription, we grant you a limited, non-exclusive, non-transferable and revocable licence to use the service for the needs of your business. You may not copy, modify, resell, decompile or attempt to extract the source code of the service, nor use it to create a competing service.",
        "Your data belongs to you (see the next section).",
      ],
    },
    {
      titre: "Your data",
      contenu: [
        "You remain the owner of the data you enter into Gozly (“your data”). You give us the right to host and process it solely to provide you with the service, as described in the Privacy Policy.",
        "As a business customer, you are responsible for having the right to enter your employees' and customers' information into Gozly and for informing them, where necessary, of how it is used.",
        "You can export your data (for example temperature logs and the timesheet). Some data is deleted automatically after the period you choose in Customization: it is up to you to export what you need to keep.",
      ],
    },
    {
      titre: "Compliance logs (temperatures, etc.)",
      contenu: [
        "Gozly is a tool to help you keep your records, notably the temperature log. It is up to you to make sure that your practices and records meet the legal requirements that apply to your business (for example those of the MAPAQ). Gozly does not replace your judgment or your regulatory obligations.",
      ],
    },
    {
      titre: "Acceptable use",
      contenu: [
        "You agree not to:",
        [
          "use Gozly unlawfully or to infringe the rights of others;",
          "attempt to access another business's data or circumvent security measures;",
          "disrupt the service (attacks, mass sending of requests, etc.);",
          "resell or sublicense access to Gozly without our written consent.",
        ],
        "In the event of a violation, we will notify you and give you a reasonable period, normally 10 days, to remedy it. If the violation is serious, repeated, or threatens the security of the service or of third parties, we may suspend or close the account immediately.",
      ],
    },
    {
      titre: "Third-party services",
      contenu: [
        "Gozly may connect to external services that you choose (for example Wix or a payroll service). Their operation and their terms are the responsibility of those third parties; we are not responsible for their interruptions or changes.",
      ],
    },
    {
      titre: "Availability and warranties",
      contenu: [
        "We make reasonable efforts to keep Gozly available and reliable, but we do not guarantee uninterrupted or error-free service. Interruptions, for maintenance or for reasons beyond our control, may occur.",
        "The service is provided “as is” to the extent permitted by law. Rights that cannot be excluded by contract, notably those under consumer protection laws where they apply, remain unaffected.",
      ],
    },
    {
      titre: "Force majeure",
      contenu: [
        "Neither party is liable for a delay or failure caused by an event beyond its reasonable control: a major outage of a hosting, electricity or telecommunications provider, a cyberattack despite reasonable measures, a natural disaster, a government measure, a labour dispute, etc. The affected obligations are suspended for the duration of the event.",
      ],
    },
    {
      titre: "Limitation of liability",
      contenu: [
        "To the extent permitted by law, Gozly is not liable for indirect damages (loss of profits, business opportunities or data resulting from your own choices, for example not having exported your data in time). Our total liability to you, for any claim related to the service, is limited to the amounts you paid to Gozly in the 12 months preceding the event.",
        "This limit does not apply to our gross or intentional fault, nor in cases where the law does not allow liability to be limited.",
      ],
    },
    {
      titre: "End of service and what happens to your data",
      contenu: [
        "You can close your account at any time. We may suspend or end access in the event of non-payment or breach of these terms, in accordance with the “Acceptable use” section.",
        `After an account is closed, you have ${LEGAL.delaiExportApresFermetureJours} days to export your data. After that period, it is destroyed within the following ${LEGAL.delaiSuppressionApresExportJours} days, except for information that the law requires us to keep (for example billing documents), as explained in the Privacy Policy.`,
      ],
    },
    {
      titre: "Changes, governing law and contact",
      contenu: [
        "We may change these terms. For any important change, we will notify you at least 30 days in advance (by email or in the application). If you refuse the change, you may cancel your subscription before it takes effect, without penalty. Continuing to use Gozly after that date constitutes acceptance of the new terms.",
        "These terms constitute the entire agreement between you and Gozly regarding the service and replace any prior agreement. If a clause is declared invalid or unenforceable, the others remain in force.",
        "These terms are written in French. If they are translated into another language, the French version prevails in the event of a discrepancy.",
        "These terms are governed by the laws of Quebec and the laws of Canada applicable therein. Any dispute falls under the jurisdiction of the competent courts of Quebec.",
        `Questions: ${LEGAL.courrielContact}.`,
      ],
    },
  ],
};

export const CONFIDENTIALITE_EN = {
  titre: "Privacy policy",
  intro:
    "This policy explains what personal information Gozly collects, why, who it is shared with, and how to exercise your rights.",
  sections: [
    {
      titre: "Who is responsible for your information",
      contenu: [
        `${LEGAL.nomLegal} (“Gozly”, “we”) operates the platform available at ${LEGAL.siteUrl}, a set of management tools for small and medium-sized businesses (schedule, time clock, inventory, sales tracking, temperature log, team chat, etc.).`,
        "We act as the person in charge of the personal information of our customers (the businesses that subscribe) and of their users. For the information about their employees that businesses enter into Gozly, the customer business remains responsible for its collection and use, and Gozly hosts and processes it on its behalf.",
        `For any question about the protection of your personal information, or to reach our person in charge of the protection of personal information: ${LEGAL.courrielConfidentialite}.`,
      ],
    },
    {
      titre: "Information we collect",
      contenu: [
        "Depending on the modules your business uses, Gozly may contain:",
        [
          "Account: name, email, password (stored securely), business name, plan.",
          "Linked Discord account (optional): if you link your Gozly account to the Gozly Discord server, we keep your Discord ID (a number) in order to give you the \"Compte lié\" role. You can unlink your account at any time.",
          "Employees: name, email or phone, employee number, PIN to log in to the mobile app, assigned branch(es), schedule, shifts, time-off and shift swap requests.",
          "Time clock: clock-in and clock-out times. If the business turns on mobile clock-in, the device's GPS position is checked at the time of clock-in to confirm the person is at the branch; we do not track your movements continuously.",
          "Temperature log: temperature readings, equipment, date, slot (AM/PM) and the name of the person who took the reading.",
          "Inventory and sales: products, quantities, sales entered, and data coming from the services the business chooses to connect (for example Wix).",
          "Team chat: messages exchanged between members of the same business.",
          "Payment: card information is entered directly with our payment processor (Stripe). Gozly does not see or store your full card number.",
          "Technical data: notification subscription, technical logs necessary for the proper operation and security of the service.",
        ],
      ],
    },
    {
      titre: "Why we use it",
      contenu: [
        "We use this information solely to provide, secure and improve the service: operating the modules, authenticating users, sending the notifications requested, billing the subscription and responding to your support requests.",
        "We do not sell your personal information and do not use it for advertising purposes.",
      ],
    },
    {
      titre: "Who has access and where it is hosted",
      contenu: [
        "Within a business, access depends on the permissions given by the administrator (for example, an employee only sees what the mobile app allows them to see). One business's data is never visible to another business.",
        "We use service providers to run Gozly:",
        [
          "Supabase: database and authentication. Data is hosted in Canada (Canada Central region).",
          "Vercel: application hosting. Some processing may take place in the United States.",
          "Stripe: payment and subscription processing, mainly in Canada and the United States.",
          "Wix, Nethris or other services: only if your business chooses to connect them to Gozly.",
        ],
        "Some of these providers are based in the United States or process data there, and may be subject to laws different from those of Quebec. Before entrusting personal information to a provider, or transferring it outside Quebec, we assess the privacy risks and, where required, provide contractual protections (data processing agreements) with that provider.",
        "We may also disclose information if required by law or by a court order.",
      ],
    },
    {
      titre: "Retention and destruction",
      contenu: [
        "We keep information only for as long as necessary for the purposes for which it was collected, then we destroy it. In practice:",
        [
          "Account and module data: as long as the business's account is active. Some data is deleted automatically after a period that the business sets in Customization (for example temperature logs: 3, 6 or 12 months; processed time-off and swap requests).",
          `After an account is closed: ${LEGAL.delaiExportApresFermetureJours} days to export the data, then destruction within the following ${LEGAL.delaiSuppressionApresExportJours} days.`,
          `Billing and payments: ${LEGAL.conservationFacturationAnnees} years, as required by tax laws for accounting records.`,
          "Backup copies: they are overwritten according to our provider's normal cycle, which can delay by a few weeks the complete disappearance of deleted data.",
          "Technical logs: kept for a limited time, according to our providers' settings, solely for security and troubleshooting.",
        ],
        "The customer business can export its data before it is deleted.",
      ],
    },
    {
      titre: "Security and privacy incidents",
      contenu: [
        "We take reasonable measures to protect your information: encrypted connections (HTTPS), separation of data between businesses, access control, encryption of the credentials of connected external services (for example payroll) and limits on login attempts.",
        "No system is perfectly secure. We keep a register of privacy incidents, as the law requires. In the event of an incident presenting a risk of serious injury, we will notify the persons concerned and the Commission d'accès à l'information du Québec.",
      ],
    },
    {
      titre: "Your rights",
      contenu: [
        "In accordance with the Act respecting the protection of personal information in the private sector (Law 25), you may ask to access the information we hold about you, have it corrected, withdraw your consent or ask for it to be deleted, subject to the exceptions provided by law (for example, what we must keep for billing purposes).",
        `Write to us at ${LEGAL.courrielConfidentialite}. We respond within 30 days. If you are an employee of a customer business, we may ask you to contact your employer first, who is responsible for this information. You may also file a complaint with the Commission d'accès à l'information du Québec.`,
      ],
    },
    {
      titre: "Minimum age",
      contenu: [
        "Gozly is intended for businesses: the account must be created by an adult. A business that registers employees under 14 in Gozly is responsible for first obtaining the consent of the parent or guardian, as the law requires.",
      ],
    },
    {
      titre: "Cookies and local storage",
      contenu: [
        "Gozly uses your browser's storage only to keep your session open and remember your preferences (for example the theme). We do not use advertising cookies or third-party tracking.",
      ],
    },
    {
      titre: "Changes to this policy",
      contenu: [
        "We may update this policy. The date of the last update appears at the top of the page, and we will notify customers of important changes.",
      ],
    },
  ],
};
