import { encrypt, decrypt } from "@/lib/paieCrypto";
import { chargerEquipements } from "@/lib/equipementsTemperature";
import { dateStr, relevesEnCsv } from "@/lib/temperature";
import * as microsoft from "@/lib/stockageMicrosoft";
import * as google from "@/lib/stockageGoogle";
import { journeesEnCsv, pdfJournees, octetsPdf } from "@/lib/ventesExport";

// Exports automatiques vers le stockage en ligne de l'entreprise (OneDrive ou Google Drive). Pour l'instant : les fiches de température en CSV.

export const FOURNISSEURS = {
  microsoft: { nom: "OneDrive", lib: microsoft },
  google: { nom: "Google Drive", lib: google },
};

const DOSSIER_RACINE = "Gozly";
const DOSSIER_TEMPERATURES = "Temperatures";
const DOSSIER_VENTES = "Ventes";

function versIso(d) {
  return d.toISOString().slice(0, 10);
}

function ajouterJours(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return versIso(d);
}

// Dernière période COMPLÈTE : la semaine passée (lundi à dimanche) ou le mois passé.
export function dernierePeriode(frequence, aujourdhui) {
  const d = new Date(`${aujourdhui}T00:00:00Z`);
  if (frequence === "mensuel") {
    return {
      debut: versIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))),
      fin: versIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0))),
    };
  }
  const lundiCourant = ajouterJours(aujourdhui, -((d.getUTCDay() + 6) % 7));
  return { debut: ajouterJours(lundiCourant, -7), fin: ajouterJours(lundiCourant, -1) };
}

async function relevesEntre(service, entrepriseId, debut, fin) {
  const tous = [];
  for (let depart = 0; ; depart += 1000) {
    const { data } = await service
      .from("releves_temperature")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date_relevee", debut)
      .lte("date_relevee", fin)
      .order("date_relevee", { ascending: false })
      .order("id", { ascending: true })
      .range(depart, depart + 999);
    tous.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return tous;
}

// Jeton d'accès frais ; garde en base le jeton d'actualisation le plus récent (Microsoft en renvoie un nouveau à chaque fois, Google non).
export async function jetonAcces(service, connexion) {
  const { accessToken, refreshToken } = await FOURNISSEURS[connexion.fournisseur].lib.rafraichirJeton(decrypt(connexion.jeton_actualisation_chiffre));
  if (refreshToken) {
    await service
      .from("stockage_connexions")
      .update({ jeton_actualisation_chiffre: encrypt(refreshToken), updated_at: new Date().toISOString() })
      .eq("id", connexion.id);
  }
  return accessToken;
}

async function deposerTemperatures(service, connexion, accessToken, debut, fin) {
  const releves = await relevesEntre(service, connexion.entreprise_id, debut, fin);
  if (releves.length === 0) return 0;

  const equipements = await chargerEquipements(service, connexion.entreprise_id);
  const { data: emplacements } = await service.from("emplacements").select("id, nom").eq("entreprise_id", connexion.entreprise_id);
  const csv = relevesEnCsv(releves, equipements, emplacements || []);

  await FOURNISSEURS[connexion.fournisseur].lib.deposerFichier(accessToken, [DOSSIER_RACINE, DOSSIER_TEMPERATURES, `Temperatures_${debut}_au_${fin}.csv`], csv);
  return releves.length;
}

// Résumés des journées de ventes importées de la période, en Excel (CSV) ET en PDF. Les transactions ne sont pas gardées chez Gozly :
// le fichier contient donc les totaux par journée (modes de paiement, taxes, écart Moneris...).
async function deposerVentes(service, connexion, accessToken, debut, fin) {
  const { data: jours } = await service
    .from("ventes_jours")
    .select("*")
    .eq("entreprise_id", connexion.entreprise_id)
    .gte("date", debut)
    .lte("date", fin)
    .order("date", { ascending: true });
  if (!jours || jours.length === 0) return 0;

  const { data: entreprise } = await service.from("entreprises").select("nom, ventes_terminal_nom").eq("id", connexion.entreprise_id).maybeSingle();
  const base = `Ventes_${debut}_au_${fin}`;
  const lib = FOURNISSEURS[connexion.fournisseur].lib;
  await lib.deposerFichier(accessToken, [DOSSIER_RACINE, DOSSIER_VENTES, `${base}.csv`], journeesEnCsv(jours, entreprise?.ventes_terminal_nom || "Terminal"));
  const doc = await pdfJournees({ entrepriseNom: entreprise?.nom || "", periodeLabel: `${debut} au ${fin}`, jours, terminal: entreprise?.ventes_terminal_nom || "Terminal" });
  await lib.deposerFichier(accessToken, [DOSSIER_RACINE, DOSSIER_VENTES, `${base}.pdf`], octetsPdf(doc), "application/pdf");
  return jours.length;
}

// Enregistre l'échec sur la connexion (visible dans Paramètres > Intégrations).
async function noterEchec(service, connexion, erreur) {
  const reconnecter = erreur?.code === "invalid_grant" || erreur?.code === "interaction_required";
  await service
    .from("stockage_connexions")
    .update({
      derniere_erreur: reconnecter ? `La connexion à ${FOURNISSEURS[connexion.fournisseur].nom} a expiré : reconnecte ton compte.` : String(erreur?.message || "Échec de l'export.").slice(0, 300),
      ...(reconnecter ? { statut: "a_reconnecter" } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connexion.id);
}

// Export automatique (appelé chaque jour par le cron) : pour chaque sujet (températures, ventes), ne fait quelque chose que si la
// dernière période complète n'a pas encore été exportée.
const SUJETS = [
  { cle: "temperatures", frequence: "export_temperatures", dernier: "dernier_export_temperatures", deposer: deposerTemperatures },
  { cle: "ventes", frequence: "export_ventes", dernier: "dernier_export_ventes", deposer: deposerVentes },
];

export async function exporterSiNecessaire(service, connexion) {
  let resultat = { ignore: true };
  for (const sujet of SUJETS) {
    const frequence = connexion[sujet.frequence];
    if (frequence !== "hebdo" && frequence !== "mensuel") continue;

    const { debut, fin } = dernierePeriode(frequence, dateStr(new Date()));
    if (connexion[sujet.dernier] && connexion[sujet.dernier] >= fin) continue;

    try {
      const accessToken = await jetonAcces(service, connexion);
      const nb = await sujet.deposer(service, connexion, accessToken, debut, fin);
      await service
        .from("stockage_connexions")
        .update({ [sujet.dernier]: fin, derniere_erreur: null, updated_at: new Date().toISOString() })
        .eq("id", connexion.id);
      if (!resultat.erreur) resultat = { ok: true, [sujet.cle]: nb };
    } catch (erreur) {
      console.error("Export stockage échoué:", erreur);
      await noterEchec(service, connexion, erreur);
      resultat = { erreur: true };
    }
  }
  return resultat;
}

// « Exporter maintenant » : les 30 derniers jours, tout de suite (sert aussi à vérifier que la connexion fonctionne).
export async function exporterMaintenant(service, connexion, sujet = "temperatures") {
  const fin = dateStr(new Date());
  const debut = ajouterJours(fin, -30);
  try {
    const accessToken = await jetonAcces(service, connexion);
    const nb = await (sujet === "ventes" ? deposerVentes : deposerTemperatures)(service, connexion, accessToken, debut, fin);
    await service.from("stockage_connexions").update({ derniere_erreur: null, updated_at: new Date().toISOString() }).eq("id", connexion.id);
    return { ok: true, releves: nb, journees: nb, debut, fin };
  } catch (erreur) {
    console.error("Export manuel stockage échoué:", erreur);
    await noterEchec(service, connexion, erreur);
    return { erreur: erreur?.message || "Échec de l'export." };
  }
}
