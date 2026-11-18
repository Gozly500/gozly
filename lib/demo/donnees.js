import { uuid } from "./moteur";

// Données de départ de la démo : une entreprise fictive (un petit café-restaurant, 15 employés, 2 emplacements) avec
// tous les modules prêts à essayer. Tout est généré ici, dans le navigateur : les dates suivent la date du jour (la
// semaine en cours est toujours « vivante ») et rien ne vient de, ni ne va vers, un serveur.

export const UTILISATEUR_DEMO = { id: "d0000000-0000-4000-8000-000000000001", email: "alex@cafelecoin.demo", nom: "Alex Tremblay" };
export const ENTREPRISE_DEMO = { id: "d0000000-0000-4000-8000-0000000000e1", nom: "Café Le Coin (démo)" };

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function ajouterJours(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function lundi(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const j = (x.getDay() + 6) % 7; // 0 = lundi
  x.setDate(x.getDate() - j);
  return x;
}
function horodatage(date, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const x = new Date(date);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
}
// Petit générateur pseudo-aléatoire stable (les mêmes données à chaque démarrage, pour des captures d'écran prévisibles).
function graine(n) {
  let s = n;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const NOMS = [
  ["Léa Tremblay", "gestionnaire"],
  ["Marc-André Gagnon", "employe"],
  ["Sofia Rossi", "employe"],
  ["Karim Benali", "employe"],
  ["Julie Bouchard", "gestionnaire"],
  ["Olivier Roy", "employe"],
  ["Camille Lavoie", "employe"],
  ["Nathan Pelletier", "employe"],
  ["Émilie Côté", "employe"],
  ["Antoine Fortin", "employe"],
  ["Maya Gauthier", "employe"],
  ["Samuel Morin", "employe"],
  ["Chloé Lefebvre", "employe"],
  ["Mathis Bergeron", "employe"],
  ["Zoé Ouellet", "employe"],
];

const POSTES = ["Cuisine", "Salle", "Caisse", "Comptoir"];
const QUARTS_TYPES = [
  ["07:00", "15:00"],
  ["08:00", "16:00"],
  ["10:00", "18:00"],
  ["11:00", "19:00"],
  ["16:00", "23:00"],
];

export function semer(etat) {
  const T = (nom) => (etat.tables[nom] = etat.tables[nom] || []);
  const ajouter = (nom, ligne) => {
    const l = { id: uuid(), created_at: new Date().toISOString(), ...ligne };
    T(nom).push(l);
    return l;
  };
  const eid = ENTREPRISE_DEMO.id;
  const alea = graine(42);
  const aujourdhui = new Date();
  aujourdhui.setHours(12, 0, 0, 0);
  const lundiCourant = lundi(aujourdhui);

  etat.meta = { cree_le: new Date().toISOString(), integrations: { onedrive: true, nethris: true } };

  // ----- Forfaits (le compte de démo est « Crystal » : tous les modules activables, sans plafond) -----
  [
    { id: "opale", label: "Opale", limite_modules: 3, limite_entreprises: 1, limite_employes: 15, publique: true, ordre: 1 },
    { id: "onyx", label: "Onyx", limite_modules: 5, limite_entreprises: 3, limite_employes: 30, publique: true, ordre: 2 },
    { id: "crystal", label: "Crystal", limite_modules: null, limite_entreprises: 5, limite_employes: null, publique: true, ordre: 3 },
  ].forEach((f) => T("forfaits").push({ personnalise: false, actif: true, modules_autorises: null, ...f }));

  // ----- Compte, entreprise, équipe -----
  T("profils").push({
    id: UTILISATEUR_DEMO.id,
    full_name: UTILISATEUR_DEMO.nom,
    prenom: "Alex",
    nom: "Tremblay",
    forfait: "crystal",
    theme: "gozly",
    theme_accent: null,
    langue: "fr",
    desactive: false,
    avatar: null,
    avatar_url: null,
  });
  T("entreprises").push({
    id: eid,
    nom: ENTREPRISE_DEMO.nom,
    forfait: "crystal",
    secteur_activite: "Restauration",
    adresse: "123, rue Principale, Montréal (Québec)",
    telephone: "514 555-0123",
    courriel_contact: "bonjour@cafelecoin.demo",
    code_acces: "DEMO2026",
    logo_url: null,
    pointage_calcul_mode: "reel",
    pointage_mobile_actif: true,
    pointage_rappels_actif: false,
    conges_actif: true,
    echanges_actif: true,
    auto_approuver_conges: false,
    auto_approuver_echanges: false,
    feuille_temps_visible_sans_approbation: false,
    premier_jour_semaine: "lundi",
    temperature_retention_mois: 12,
    temperature_rappels_actif: true,
    demandes_retention_mois: 6,
    commandes_retention_mois: 12,
    raccourcis_modules_caches: [],
    dashboard_widgets: null,
    employes_extra: 0,
    employes_extra_achetes: 0,
    created_at: new Date(Date.now() - 200 * 86400000).toISOString(),
  });
  T("membres").push({ id: uuid(), entreprise_id: eid, user_id: UTILISATEUR_DEMO.id, role: "proprietaire", created_at: new Date().toISOString() });

  ["planning", "horaire", "inventaire", "ventes", "temperature"].forEach((m) => ajouter("modules_actifs", { entreprise_id: eid, module: m }));

  const emp1 = ajouter("emplacements", { entreprise_id: eid, nom: "Centre-ville", adresse: "123, rue Principale", latitude: 45.5017, longitude: -73.5673, horaires_ouverture: null });
  const emp2 = ajouter("emplacements", { entreprise_id: eid, nom: "Rive-Sud", adresse: "45, boulevard Taschereau", latitude: 45.4767, longitude: -73.4668, horaires_ouverture: null });

  const employes = NOMS.map(([nom, role], i) =>
    ajouter("employes", {
      entreprise_id: eid,
      nom,
      role,
      courriel: `${nom.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@cafelecoin.demo`,
      telephone: `514 555-${String(1000 + i * 37).slice(0, 4)}`,
      numero_paie: String(2000 + i),
      nip: String(1111 * ((i % 8) + 1)),
      avatar: null,
      derniere_connexion: horodatage(ajouterJours(aujourdhui, -(i % 4)), "09:15"),
    })
  );
  // Qui travaille où : 8 au centre-ville, 5 sur la Rive-Sud, 2 aux deux endroits.
  employes.forEach((e, i) => {
    if (i < 8 || i >= 13) ajouter("employe_emplacements", { employe_id: e.id, emplacement_id: emp1.id });
    if ((i >= 8 && i < 13) || i >= 13) ajouter("employe_emplacements", { employe_id: e.id, emplacement_id: emp2.id });
  });

  // ----- Horaire : semaine précédente, en cours et suivante -----
  const duCentre = employes.filter((_, i) => i < 8 || i >= 13);
  const deLaRive = employes.filter((_, i) => i >= 8);
  const quartsParJour = [];
  for (let semaine = -1; semaine <= 1; semaine++) {
    for (let j = 0; j < 7; j++) {
      const date = ajouterJours(lundiCourant, semaine * 7 + j);
      const publie = semaine <= 0 || j < 3; // une partie de la semaine prochaine reste en brouillon
      const dejaLa = new Set(); // une même personne n'est pas à deux endroits le même jour
      [[emp1, duCentre, j >= 5 ? 3 : 4], [emp2, deLaRive, j >= 5 ? 2 : 3]].forEach(([emp, equipe, nb]) => {
        const choisis = [...equipe].sort(() => alea() - 0.5).filter((e) => !dejaLa.has(e.id)).slice(0, nb);
        choisis.forEach((e) => dejaLa.add(e.id));
        choisis.forEach((e, k) => {
          const [debut, fin] = QUARTS_TYPES[Math.floor(alea() * QUARTS_TYPES.length)];
          const q = ajouter("planning_quarts", {
            entreprise_id: eid,
            employe_id: e.id,
            emplacement_id: emp.id,
            date: iso(date),
            heure_debut: `${debut}:00`,
            heure_fin: `${fin}:00`,
            poste: POSTES[(k + j) % POSTES.length],
            publie,
            echange_de: null,
          });
          quartsParJour.push({ q, date, emp, e, debut, fin });
        });
      });
    }
  }

  // ----- Pointages : les 7 derniers jours (heures réelles légèrement décalées) + quelques personnes « en poste » -----
  const maintenant = new Date();
  quartsParJour
    .filter(({ date }) => date <= aujourdhui && date >= ajouterJours(aujourdhui, -7))
    .forEach(({ date, emp, e, debut, fin }) => {
      const memeJour = iso(date) === iso(aujourdhui);
      const decal = (n) => Math.round((alea() - 0.4) * n);
      const [hd, md] = debut.split(":").map(Number);
      const [hf, mf] = fin.split(":").map(Number);
      const entree = new Date(date);
      entree.setHours(hd, md + decal(10), 0, 0);
      const sortie = new Date(date);
      sortie.setHours(hf, mf + decal(14), 0, 0);
      if (memeJour && entree > maintenant) return; // pas encore commencé
      ajouter("pointages", {
        entreprise_id: eid,
        employe_id: e.id,
        emplacement_id: emp.id,
        entree: entree.toISOString(),
        sortie: memeJour && sortie > maintenant ? null : sortie.toISOString(),
        sortie_auto: false,
        source: "kiosque",
        latitude: null,
        longitude: null,
      });
    });

  // ----- Demandes de congé et d'échange -----
  ajouter("demandes_conge", { entreprise_id: eid, employe_id: employes[2].id, date_debut: iso(ajouterJours(aujourdhui, 9)), date_fin: iso(ajouterJours(aujourdhui, 11)), raison: "Mariage d'une amie", statut: "en_attente", traite_par: null, traite_le: null });
  ajouter("demandes_conge", { entreprise_id: eid, employe_id: employes[6].id, date_debut: iso(ajouterJours(aujourdhui, 14)), date_fin: iso(ajouterJours(aujourdhui, 14)), raison: "Rendez-vous médical", statut: "en_attente", traite_par: null, traite_le: null });
  ajouter("demandes_conge", { entreprise_id: eid, employe_id: employes[9].id, date_debut: iso(ajouterJours(aujourdhui, -12)), date_fin: iso(ajouterJours(aujourdhui, -10)), raison: "Vacances", statut: "approuve", traite_par: UTILISATEUR_DEMO.id, traite_le: horodatage(ajouterJours(aujourdhui, -20), "10:00") });
  const quartFutur = quartsParJour.find(({ date }) => date > ajouterJours(aujourdhui, 1));
  if (quartFutur) {
    const receveur = employes.find((e) => e.id !== quartFutur.e.id);
    ajouter("demandes_echange", {
      entreprise_id: eid,
      quart_id: quartFutur.q.id,
      employe_donneur_id: quartFutur.e.id,
      employe_receveur_id: receveur.id,
      statut_employe: "accepte",
      statut_admin: "en_attente",
      traite_le: null,
    });
  }

  // Semaine précédente déjà approuvée dans la feuille de temps.
  ajouter("feuille_temps_semaines", { entreprise_id: eid, emplacement_id: emp1.id, semaine_debut: iso(ajouterJours(lundiCourant, -7)), approuve_par: UTILISATEUR_DEMO.id, approuve_le: horodatage(ajouterJours(lundiCourant, -1), "16:30") });

  // ----- Tâches -----
  const cats = ["Ouverture", "Service", "Fermeture"].map((nom, i) => ajouter("categories", { entreprise_id: eid, nom, ordre: i }));
  const modeles = {
    Ouverture: ["Allumer les équipements", "Vérifier les températures", "Préparer la salle", "Compter la caisse"],
    Service: ["Réapprovisionner le comptoir", "Nettoyer les tables", "Vider les poubelles"],
    Fermeture: ["Nettoyer la cuisine", "Fermer la caisse", "Éteindre les équipements", "Barrer les portes"],
  };
  cats.forEach((c) => modeles[c.nom].forEach((nom) => ajouter("taches_modeles", { entreprise_id: eid, categorie_id: c.id, nom })));
  for (let j = -2; j <= 4; j++) {
    const date = iso(ajouterJours(aujourdhui, j));
    cats.forEach((c) =>
      modeles[c.nom].forEach((texte, k) =>
        ajouter("taches", {
          entreprise_id: eid,
          categorie_id: c.id,
          emplacement_id: emp1.id,
          date,
          texte,
          terminee: j < 0 || (j === 0 && c.nom === "Ouverture"),
          source: null,
          source_cle: null,
          source_qte: null,
        })
      )
    );
  }

  // ----- Inventaire -----
  const catsInv = ["Ingrédients", "Boissons", "Emballages"].map((nom, i) => ajouter("categories_inventaire", { entreprise_id: eid, nom, ordre: i, source: null, source_id: null }));
  const produits = [
    [0, "Farine tout usage", "ING-001", 24, 10, 4.5],
    [0, "Sucre blanc", "ING-002", 18, 8, 3.2],
    [0, "Beurre non salé", "ING-003", 6, 8, 6.8],
    [0, "Œufs (douzaine)", "ING-004", 15, 10, 4.1],
    [0, "Tomates concassées", "ING-005", 5, 8, 2.9],
    [0, "Huile d'olive", "ING-006", 12, 5, 12.5],
    [0, "Fromage mozzarella", "ING-007", 9, 6, 9.9],
    [1, "Café en grains (1 kg)", "BOI-001", 14, 6, 18.0],
    [1, "Lait 2 % (4 L)", "BOI-002", 7, 10, 6.5],
    [1, "Lait d'avoine (1 L)", "BOI-003", 11, 6, 3.8],
    [1, "Thé vert", "BOI-004", 20, 8, 7.2],
    [1, "Sirop d'érable", "BOI-005", 8, 4, 14.0],
    [2, "Gobelets 12 oz", "EMB-001", 220, 100, 0.12],
    [2, "Gobelets 16 oz", "EMB-002", 80, 100, 0.15],
    [2, "Couvercles", "EMB-003", 310, 150, 0.06],
    [2, "Boîtes à sandwich", "EMB-004", 140, 60, 0.35],
    [2, "Serviettes de table", "EMB-005", 900, 400, 0.02],
  ];
  produits.forEach(([c, nom, sku, quantite, seuil, prix], i) =>
    ajouter("produits_inventaire", { entreprise_id: eid, categorie_id: catsInv[c].id, nom, sku, quantite, seuil_alerte: seuil, prix, notes: null, ordre: i, source: null, source_id: null, updated_at: new Date().toISOString() })
  );

  // ----- Suivi des ventes : 45 jours, plusieurs sources -----
  for (let j = 45; j >= 0; j--) {
    const date = ajouterJours(aujourdhui, -j);
    const fin = date.getDay() === 0 || date.getDay() === 6;
    const base = fin ? 1.35 : 1;
    [
      ["moneris", 900, "Terminal de paiement"],
      ["wix", 320, "Commandes en ligne"],
      ["comptant", 180, "Comptant au comptoir"],
    ].forEach(([source, moyenne, description]) => {
      ajouter("ventes", { entreprise_id: eid, source, montant: Math.round(moyenne * base * (0.7 + alea() * 0.6) * 100) / 100, date: iso(date), description, source_id: null });
    });
  }

  // ----- Températures (MAPAQ) -----
  const catsTemp = ["Cuisine", "Salle"].map((nom) => ajouter("categories_temperature", { entreprise_id: eid, nom }));
  const equipements = [
    ["Frigo principal", "refrigerateur", 0],
    ["Frigo boissons", "refrigerateur", 1],
    ["Congélateur 1", "congelateur", 0],
    ["Congélateur 2", "congelateur", 0],
    ["Vitrine réfrigérée", "refrigerateur", 1],
  ].map(([nom, type, c], i) => ajouter("equipements_temperature", { entreprise_id: eid, emplacement_id: emp1.id, nom, type, categorie_id: catsTemp[c].id, ordre: i, unite: "C" }));
  for (let j = 6; j >= 0; j--) {
    const date = ajouterJours(aujourdhui, -j);
    ["am", "pm"].forEach((periode) => {
      if (j === 0 && periode === "pm") return;
      equipements.forEach((eq) => {
        const congele = eq.type === "congelateur";
        const temperature = congele ? -19 + Math.round(alea() * 30) / 10 : 2 + Math.round(alea() * 20) / 10;
        const releveur = employes[(j + (periode === "am" ? 0 : 3)) % employes.length];
        ajouter("releves_temperature", {
          entreprise_id: eid,
          equipement_id: eq.id,
          employe_id: releveur.id,
          releve_par: releveur.nom,
          temperature,
          conforme: congele ? temperature <= -18 : temperature <= 4,
          note: null,
          date_relevee: iso(date),
          periode,
          created_at: horodatage(date, periode === "am" ? "08:10" : "16:40"),
        });
      });
    });
  }

  // ----- Discussion -----
  const conv = ajouter("conversations", { entreprise_id: eid, type: "equipe" });
  [
    [employes[0], "Bonjour l'équipe! N'oubliez pas l'inventaire de jeudi 👍", -3],
    [employes[2], "Je peux prendre un quart de plus samedi si quelqu'un veut congé", -2],
    [employes[4], "Parfait Sofia, je te l'ajoute à l'horaire", -2],
    [employes[7], "La machine à café fait un bruit bizarre depuis ce matin", -1],
    [employes[0], "Merci Nathan, je préviens le technicien", -1],
  ].forEach(([e, contenu, jours], i) => ajouter("messages", { conversation_id: conv.id, employe_id: e.id, user_id: null, contenu, created_at: horodatage(ajouterJours(aujourdhui, jours), `${9 + i}:${pad(10 + i * 7)}`) }));
  ajouter("messages", { conversation_id: conv.id, employe_id: null, user_id: UTILISATEUR_DEMO.id, contenu: "Bienvenue dans la démo Gozly! Essaie de modifier l'horaire ou d'ajouter un employé 😊", created_at: new Date().toISOString() });

  // ----- Intégrations déjà « connectées » (fictives) -----
  ajouter("stockage_connexions", { entreprise_id: eid, fournisseur: "microsoft", compte_email: "comptabilite@cafelecoin.demo", jeton_actualisation_chiffre: "demo", statut: "connecte", export_temperatures: "hebdo", dernier_export_temperatures: iso(ajouterJours(aujourdhui, -3)), derniere_erreur: null });
  ajouter("integrations_installees", { entreprise_id: eid, integration_id: "onedrive" });
  ajouter("integrations_installees", { entreprise_id: eid, integration_id: "nethris" });
}
