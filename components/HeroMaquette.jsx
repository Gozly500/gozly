import { getT } from "@/lib/i18n/siteServer";
import MaquetteRotation from "@/components/MaquetteRotation";
import { IconMaison, IconFlecheGauche, IconFlecheDroite, IconAttention } from "@/components/icons/Pictogrammes";
import {
  IconDiscussion,
  IconEmployes,
  IconParametres,
  IconPlanning,
  IconHoraire,
  IconInventaire,
  IconVentes,
  IconFeuilleTemps,
  IconDemande,
  IconIntegration,
} from "@/components/icons/GozlyIcons";

// Maquettes fidèles des vraies pages du tableau de bord (Tâches, Horaire, Inventaire, Suivi
// des ventes), qui défilent toutes les 5 s dans le hero de l'accueil. HTML/CSS pur : nettes
// partout, traduites, sans image. Prénoms, produits et montants fictifs. Les styles reprennent
// ceux du vrai tableau de bord (préfixe .mq- dans globals.css).

const TXT = {
  fr: {
    taches: { titre: "Tâches", sous: "Choisis un jour pour voir ou préparer ses tâches.", nouvelle: "+ Nouvelle tâche", fait: "Fait", afaire: "À faire",
      liste: [["Allumer les équipements", "Cuisine", 1], ["Vérifier les températures", "Cuisine", 1], ["Préparer la salle", "Salle", 0], ["Compter la caisse", "Caisse", 0], ["Commande de fournisseur", "Gestion", 0]] },
    inv: { titre: "Inventaire", sous: "Tes produits et la liste de ce qu'il faut aller chercher.", onglets: ["Produits", "Liste à préparer"], recherche: "Rechercher un produit...", ajouter: "+ Ajouter", stock: "Stock", seuil: "Seuil", wix: "Wix",
      cats: [["Ingrédients", [["Farine tout usage", "24 sacs", 10, 24, 1], ["Tomates concassées", "6 boîtes", 8, 6, 1, true], ["Huile d'olive", "12 bouteilles", 5, 12, 0]]], ["Emballages", [["Boîtes à pizza", "140 unités", 60, 140, 1], ["Verres 12 oz", "52 unités", 40, 52, 0]]]] },
    ventes: { titre: "Suivi des ventes", sous: "Ce qui est rentré cette semaine, par source.", prec: "Semaine précédente", suiv: "Semaine suivante", semaine: "16 nov. – 22 nov. 2026", ajouter: "+ Ajouter une vente", total: "Total", wixImport: "Importée de Wix",
      sources: [["Wix (en ligne)", "1 482,50 $"], ["Moneris", "3 126,00 $"], ["Comptant", "412,25 $"]], totalMontant: "5 020,75 $",
      lignes: [["Lun. 16 nov. — Wix (en ligne)", "Importée de Wix", "684,50 $"], ["Lun. 16 nov. — Moneris", "Terminal 1", "1 240,00 $"], ["Mar. 17 nov. — Comptant", "Fermeture", "212,25 $"]] },
  },
  en: {
    taches: { titre: "Tasks", sous: "Pick a day to see or prepare its tasks.", nouvelle: "+ New task", fait: "Done", afaire: "To do",
      liste: [["Turn on the equipment", "Kitchen", 1], ["Check the temperatures", "Kitchen", 1], ["Set up the dining room", "Floor", 0], ["Count the till", "Cashier", 0], ["Supplier order", "Management", 0]] },
    inv: { titre: "Inventory", sous: "Your products and the list of what needs to be picked up.", onglets: ["Products", "List to prepare"], recherche: "Search a product...", ajouter: "+ Add", stock: "Stock", seuil: "Threshold", wix: "Wix",
      cats: [["Ingredients", [["All-purpose flour", "24 bags", 10, 24, 1], ["Crushed tomatoes", "6 cans", 8, 6, 1, true], ["Olive oil", "12 bottles", 5, 12, 0]]], ["Packaging", [["Pizza boxes", "140 units", 60, 140, 1], ["12 oz cups", "52 units", 40, 52, 0]]]] },
    ventes: { titre: "Sales tracking", sous: "What came in this week, by source.", prec: "Previous week", suiv: "Next week", semaine: "Nov 16 – Nov 22, 2026", ajouter: "+ Add a sale", total: "Total", wixImport: "Imported from Wix",
      sources: [["Wix (online)", "$1,482.50"], ["Moneris", "$3,126.00"], ["Cash", "$412.25"]], totalMontant: "$5,020.75",
      lignes: [["Mon. Nov 16 — Wix (online)", "Imported from Wix", "$684.50"], ["Mon. Nov 16 — Moneris", "Terminal 1", "$1,240.00"], ["Tue. Nov 17 — Cash", "Closing", "$212.25"]] },
  },
};

const JOURS_HORAIRE = [
  [["Léa", "09:00 – 17:00", 1], ["Marc", "11:00 – 19:00", 0], ["Sofia", "16:00 – 23:00", 2]],
  [["Léa", "09:00 – 17:00", 1], ["Karim", "08:00 – 16:00", 0], ["Julie", "10:00 – 18:00", 2, true]],
  [["Marc", "12:00 – 20:00", 0], ["Sofia", "16:00 – 23:00", 1]],
  [["Léa", "11:00 – 19:00", 1], ["Karim", "08:00 – 16:00", 0], ["Marc", "12:00 – 20:00", 0]],
  [["Léa", "09:00 – 17:00", 1], ["Sofia", "16:00 – 23:00", 2], ["Julie", "12:00 – 20:00", 1]],
  [["Marc", "10:00 – 18:00", 0], ["Sofia", "16:00 – 23:00", 2]],
  [["Karim", "09:00 – 15:00", 0]],
];
const DATES = [16, 17, 18, 19, 20, 21, 22];

function LogoG() {
  return (
    <svg viewBox="0 0 1182 1182" xmlns="http://www.w3.org/2000/svg">
      <g transform="matrix(0.136019,0,0,0.136019,590.551181,590.551181)">
        <g transform="matrix(1,0,0,1,-4341.666667,-4341.666667)">
          <g transform="matrix(1.736113,0,0,-1.736113,0,8680.555554)">
            <g transform="matrix(1,0,0,1,193.559941,-68.202741)">
              <path fill="#fff" d="M1330,4463C1251,4450 1107,4405 1035,4371C755,4240 546,4005 447,3709C407,3590 397,3500 402,3319C407,3180 411,3141 434,3065C502,2837 637,2636 820,2490L875,2447L878,2481C889,2610 939,2805 1000,2954C1144,3309 1421,3624 1755,3812C1919,3905 2178,3996 2332,4014C2388,4021 2389,4022 2378,4043C2359,4081 2208,4224 2136,4273C2007,4363 1857,4427 1710,4454C1634,4469 1396,4474 1330,4463Z" />
              <path fill="#fff" d="M2437,3920C1945,3858 1524,3603 1258,3205C1072,2927 980,2626 980,2292C980,2109 996,1998 1044,1838C1182,1385 1469,1042 1885,835C2034,761 2151,720 2312,688C2407,669 2455,665 2610,666C2769,667 2812,671 2920,693C3095,730 3214,770 3365,844C3531,925 3648,1009 3775,1135C3978,1338 4120,1606 4180,1899C4218,2089 4225,2364 4195,2548C4176,2666 4145,2792 4136,2796C4125,2800 2593,2407 2585,2398C2580,2393 2724,1853 2732,1844C2736,1841 2915,1884 3130,1940C3345,1997 3523,2040 3527,2037C3539,2024 3509,1923 3471,1848C3392,1689 3255,1558 3072,1462C2895,1371 2720,1331 2540,1344C2308,1360 2113,1447 1946,1609C1651,1895 1568,2330 1740,2697C1860,2955 2068,3130 2355,3217C2437,3241 2460,3244 2610,3244C2753,3245 2786,3242 2854,3222C2996,3181 3122,3113 3236,3015L3277,2980L3481,3162C3593,3261 3707,3363 3734,3387L3783,3431L3759,3456C3722,3497 3591,3603 3525,3647C3386,3739 3166,3838 3020,3874C2835,3919 2583,3939 2437,3920Z" />
              <path fill="#fff" d="M2435,3120C2315,3093 2226,3056 2135,2995C1923,2854 1788,2623 1764,2361L1757,2287L1783,2294C2070,2366 2343,2584 2480,2851C2528,2945 2580,3085 2580,3121C2580,3145 2544,3145 2435,3120Z" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

// Barre latérale commune ; `actif` = index du module (0 Tâches, 1 Horaire, 2 Inventaire, 3 Ventes).
function Side({ t, actif }) {
  const liste = (cle) => t(cle).split(",");
  const side = liste("home.mock.side");
  const mods = liste("home.mock.mods");
  const iconesSide = [IconMaison, IconDiscussion, IconEmployes, IconParametres];
  const iconesMods = [IconPlanning, IconHoraire, IconInventaire, IconVentes];
  return (
    <aside className="mq-side">
      <div className="mq-logo">
        <LogoG />
        <span>Gozly</span>
      </div>
      <nav className="mq-nav">
        {side.map((n, i) => {
          const Ic = iconesSide[i];
          return (
            <div key={n} className="mq-nav-item">
              <Ic className="gozly-icon" /> {n}
            </div>
          );
        })}
        <div className="mq-nav-label">{t("home.mock.modules")}</div>
        {mods.map((n, i) => {
          const Ic = iconesMods[i];
          return (
            <div key={n} className={`mq-nav-item${i === actif ? " on" : ""}`}>
              <Ic className="gozly-icon" /> {n}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function Entete({ titre, sous }) {
  return (
    <>
      <h3 className="mq-h1">{titre}</h3>
      <p className="mq-sous">{sous}</p>
    </>
  );
}

function Onglets({ noms, icones }) {
  return (
    <div className="mq-onglets">
      {noms.map((o, i) => {
        const Ic = icones[i];
        return (
          <span key={o} className={i === 0 ? "on" : ""}>
            <Ic className="gozly-icon" /> {o}
          </span>
        );
      })}
    </div>
  );
}

function VueHoraire({ t }) {
  const liste = (cle) => t(cle).split(",");
  const jours = liste("home.mock.jours");
  const postes = liste("home.mock.postes");
  const employes = ["Léa", "Marc", "Sofia", "Karim", "Julie"];
  return (
    <div className="mq-corps">
      <Side t={t} actif={1} />
      <div className="mq-main">
        <Entete titre={t("home.mock.titre")} sous={t("home.mock.sous")} />
        <Onglets noms={liste("home.mock.onglets")} icones={[IconHoraire, IconFeuilleTemps, IconDemande]} />
        <div className="mq-layout">
          <div className="mq-emp">
            <div className="mq-recherche">{t("home.mock.recherche")}</div>
            {employes.map((n) => (
              <div key={n} className="mq-pill">{n}</div>
            ))}
          </div>
          <div className="mq-cols">
            {JOURS_HORAIRE.map((col, ci) => (
              <div key={ci} className="mq-col">
                <div className="mq-col-tete">
                  <div className="mq-col-jour">{jours[ci]}</div>
                  <div className="mq-col-date">{DATES[ci]}</div>
                </div>
                {col.map(([nom, h, p, brouillon], k) => (
                  <div key={k} className={`mq-chip mq-anim${brouillon ? " brouillon" : ""}`} style={{ "--i": ci * 2 + k }}>
                    <div className="mq-chip-nom">
                      {nom}
                      {brouillon && <span className="mq-badge">{t("home.mock.brouillon")}</span>}
                    </div>
                    <div className="mq-chip-h">{h}</div>
                    <div className="mq-chip-poste">{postes[p]}</div>
                  </div>
                ))}
                <div className="mq-ajout">{t("home.mock.ajouter")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VueTaches({ t, x }) {
  const jours = t("home.mock.jours").split(",");
  const stats = ["5/5", "3/5", "—", "—", "—", "—", "—"];
  return (
    <div className="mq-corps">
      <Side t={t} actif={0} />
      <div className="mq-main">
        <Entete titre={x.titre} sous={x.sous} />
        <div className="mq-planif">
          {jours.map((j, i) => (
            <div key={j} className={`mq-pj${i === 1 ? " actif" : ""}${i === 1 ? " auj" : ""}`}>
              <span className="n">{j}</span>
              <span className="d">{DATES[i]}</span>
              <span className="s">{stats[i]}</span>
            </div>
          ))}
        </div>
        <div className="mq-barre-act">
          <span className="mq-bouton">{x.nouvelle}</span>
        </div>
        <div className="mq-liste">
          {x.liste.map(([nom, cat, fait], i) => (
            <div key={nom} className="mq-ligne mq-anim" style={{ "--i": i }}>
              <div>
                <div className="mq-lt">{nom}</div>
                <div className="mq-ls">{cat}</div>
              </div>
              <span className={`mq-pastille${fait ? " ok" : ""}`}>{fait ? x.fait : x.afaire}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VueInventaire({ t, x }) {
  let k = 0;
  return (
    <div className="mq-corps">
      <Side t={t} actif={2} />
      <div className="mq-main">
        <Entete titre={x.titre} sous={x.sous} />
        <Onglets noms={x.onglets} icones={[IconInventaire, IconDemande]} />
        <div className="mq-barre-act">
          <div className="mq-recherche mq-recherche-l">{x.recherche}</div>
          <span className="mq-bouton">{x.ajouter}</span>
        </div>
        {x.cats.map(([cat, produits]) => (
          <div key={cat}>
            <div className="mq-cat">{cat}</div>
            <div className="mq-liste">
              {produits.map(([nom, stock, seuil, qte, wix, alerte]) => (
                <div key={nom} className="mq-ligne mq-anim" style={{ "--i": k++ }}>
                  <div>
                    <div className="mq-lt" style={alerte ? { color: "#ff9494" } : undefined}>
                      {nom} {wix ? <IconIntegration className="gozly-icon" /> : null} {alerte ? <IconAttention className="gozly-icon" /> : null}
                    </div>
                    <div className="mq-ls">{x.stock} : {stock} · {x.seuil} : {seuil}</div>
                  </div>
                  <div className="mq-qte">
                    <span>−</span>
                    <b>{qte}</b>
                    <span>+</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VueVentes({ t, x }) {
  return (
    <div className="mq-corps">
      <Side t={t} actif={3} />
      <div className="mq-main">
        <Entete titre={x.titre} sous={x.sous} />
        <div className="mq-semaine">
          <span className="mq-bouton-g"><IconFlecheGauche className="gozly-icon" /> {x.prec}</span>
          <b>{x.semaine}</b>
          <span className="mq-bouton-g">{x.suiv} <IconFlecheDroite className="gozly-icon" /></span>
          <span className="mq-bouton" style={{ marginLeft: "auto" }}>{x.ajouter}</span>
        </div>
        <div className="mq-liste mq-liste-etroite">
          {x.sources.map(([nom, m], i) => (
            <div key={nom} className="mq-ligne mq-anim" style={{ "--i": i }}>
              <div className="mq-lt">{nom}</div>
              <div className="mq-montant">{m}</div>
            </div>
          ))}
          <div className="mq-ligne mq-anim" style={{ "--i": 3 }}>
            <div className="mq-lt">{x.total}</div>
            <div className="mq-montant fort">{x.totalMontant}</div>
          </div>
        </div>
        <div className="mq-liste">
          {x.lignes.map(([titre, sous, m], i) => (
            <div key={titre} className="mq-ligne mq-anim" style={{ "--i": i + 4 }}>
              <div>
                <div className="mq-lt">{titre}</div>
                <div className="mq-ls">{sous}</div>
              </div>
              <div className="mq-montant">{m}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HeroMaquette() {
  const { t, lang } = getT();
  const x = TXT[lang] || TXT.fr;
  return (
    <div className="mq-wrap rv" aria-hidden="true">
      <MaquetteRotation
        urls={[
          "gozly.net/dashboard/horaire",
          "gozly.net/dashboard/planning",
          "gozly.net/dashboard/inventaire",
          "gozly.net/dashboard/ventes",
        ]}
      >
        <VueHoraire t={t} />
        <VueTaches t={t} x={x.taches} />
        <VueInventaire t={t} x={x.inv} />
        <VueVentes t={t} x={x.ventes} />
      </MaquetteRotation>
    </div>
  );
}
