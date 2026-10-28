import { encrypt, decrypt } from "@/lib/paieCrypto";
import { chargerEquipements } from "@/lib/equipementsTemperature";
import { dateStr, relevesEnCsv } from "@/lib/temperature";
import { rafraichirJeton, deposerFichier } from "@/lib/stockageMicrosoft";

// Exports automatiques vers le stockage en ligne de l'entreprise (OneDrive). Pour l'instant : les fiches de température en CSV.

const DOSSIER_RACINE = "Gozly";
const DOSSIER_TEMPERATURES = "Temperatures";

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

// Jeton d'accès frais ; garde en base le jeton d'actualisation le plus récent (Microsoft en renvoie un nouveau à chaque fois).
async function jetonAcces(service, connexion) {
  const { accessToken, refreshToken } = await rafraichirJeton(decrypt(connexion.jeton_actualisation_chiffre));
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

  await deposerFichier(accessToken, [DOSSIER_RACINE, DOSSIER_TEMPERATURES, `Temperatures_${debut}_au_${fin}.csv`], csv);
  return releves.length;
}

// Enregistre l'échec sur la connexion (visible dans Paramètres > Intégrations).
async function noterEchec(service, connexion, erreur) {
  const reconnecter = erreur?.code === "invalid_grant" || erreur?.code === "interaction_required";
  await service
    .from("stockage_connexions")
    .update({
      derniere_erreur: reconnecter ? "La connexion à OneDrive a expiré : reconnecte ton compte." : String(erreur?.message || "Échec de l'export.").slice(0, 300),
      ...(reconnecter ? { statut: "a_reconnecter" } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connexion.id);
}

// Export automatique (appelé chaque jour par le cron) : ne fait quelque chose que si la dernière période complète n'a pas encore été exportée.
export async function exporterSiNecessaire(service, connexion) {
  const frequence = connexion.export_temperatures;
  if (frequence !== "hebdo" && frequence !== "mensuel") return { ignore: true };

  const { debut, fin } = dernierePeriode(frequence, dateStr(new Date()));
  if (connexion.dernier_export_temperatures && connexion.dernier_export_temperatures >= fin) return { ignore: true };

  try {
    const accessToken = await jetonAcces(service, connexion);
    const nb = await deposerTemperatures(service, connexion, accessToken, debut, fin);
    await service
      .from("stockage_connexions")
      .update({ dernier_export_temperatures: fin, derniere_erreur: null, updated_at: new Date().toISOString() })
      .eq("id", connexion.id);
    return { ok: true, releves: nb };
  } catch (erreur) {
    console.error("Export stockage échoué:", erreur);
    await noterEchec(service, connexion, erreur);
    return { erreur: true };
  }
}

// « Exporter maintenant » : les 30 derniers jours, tout de suite (sert aussi à vérifier que la connexion fonctionne).
export async function exporterMaintenant(service, connexion) {
  const fin = dateStr(new Date());
  const debut = ajouterJours(fin, -30);
  try {
    const accessToken = await jetonAcces(service, connexion);
    const nb = await deposerTemperatures(service, connexion, accessToken, debut, fin);
    await service.from("stockage_connexions").update({ derniere_erreur: null, updated_at: new Date().toISOString() }).eq("id", connexion.id);
    return { ok: true, releves: nb, debut, fin };
  } catch (erreur) {
    console.error("Export manuel stockage échoué:", erreur);
    await noterEchec(service, connexion, erreur);
    return { erreur: erreur?.message || "Échec de l'export." };
  }
}
