import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntreprise } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { decrypt } from "@/lib/paieCrypto";
import { nethrisLogin, nethrisPutFilePaie, nethrisLogout } from "@/lib/nethrisClient";

// Agrège les heures pointées d'une semaine par employé (régulières jusqu'à
// 40h, supplémentaires au-delà) - même logique que l'export CSV manuel côté
// client ([FeuilleTempsSection.jsx](../../../../components/horaire/FeuilleTempsSection.jsx)).
function agregerHeuresParEmploye(employes, pointages) {
  return employes
    .map((emp) => {
      const minutes = pointages
        .filter((p) => p.employe_id === emp.id)
        .reduce((sum, p) => {
          const fin = p.sortie ? new Date(p.sortie) : new Date();
          return sum + (fin - new Date(p.entree)) / 60000;
        }, 0);
      const heures = minutes / 60;
      return {
        numeroEmploye: emp.numero_paie || "",
        nom: emp.nom,
        heuresRegulieres: Math.min(heures, 40),
        heuresSupplementaires: Math.max(0, heures - 40),
      };
    })
    .filter((t) => t.heuresRegulieres + t.heuresSupplementaires > 0);
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// Même format que l'export CSV manuel : Numéro d'employé, Nom, Semaine du,
// Code 1 (heures régulières), Code 43 (heures supplémentaires). Best-guess
// en attendant que Nethris/le client confirme le gabarit exact attendu par
// leur configuration de paie - voir project_nethris_export dans la mémoire.
function construireCsv(totaux, weekStart) {
  const semaineDu = weekStart.toLocaleDateString("fr-CA");
  const header = [
    "Numero d'employe",
    "Nom de l'employe",
    "Semaine du",
    "Code 1 - Heures regulieres",
    "Code 43 - Heures supplementaires",
  ];
  const rows = totaux.map((t) => [
    t.numeroEmploye,
    t.nom,
    semaineDu,
    t.heuresRegulieres.toFixed(2),
    t.heuresSupplementaires.toFixed(2),
  ]);
  return [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

export async function POST(request) {
  const { weekStart } = await request.json().catch(() => ({}));
  if (!weekStart) {
    return NextResponse.json({ error: "Semaine manquante." }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntreprise(supabase, token);

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!entreprise) {
    return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "La connexion aux services de paie n'est pas encore configurée." }, { status: 501 });
  }

  const { data: connexion } = await service
    .from("paie_connexions")
    .select("*")
    .eq("entreprise_id", entreprise.id)
    .eq("service", "nethris")
    .maybeSingle();

  if (!connexion) {
    return NextResponse.json({ error: "Nethris n'est pas connecté. Va dans Entreprise → Intégrations." }, { status: 400 });
  }

  const debut = new Date(weekStart);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 7);

  const [{ data: employes }, { data: pointages }] = await Promise.all([
    service.from("employes").select("*").eq("entreprise_id", entreprise.id),
    service
      .from("pointages")
      .select("*")
      .eq("entreprise_id", entreprise.id)
      .gte("entree", debut.toISOString())
      .lt("entree", fin.toISOString()),
  ]);

  const totaux = agregerHeuresParEmploye(employes || [], pointages || []);
  if (totaux.length === 0) {
    return NextResponse.json({ error: "Aucune heure à exporter pour cette semaine." }, { status: 400 });
  }

  const csv = construireCsv(totaux, debut);
  const fileContent = Buffer.from(csv, "utf8").toString("base64");
  const fileName = `nethris-heures-${debut.toISOString().slice(0, 10)}.csv`;

  let sessionId;
  try {
    sessionId = await nethrisLogin({
      businessCode: connexion.code_entreprise,
      userCode: connexion.code_utilisateur,
      userPassword: decrypt(connexion.mot_de_passe_chiffre),
    });
  } catch (err) {
    console.error("Erreur connexion Nethris:", err.message);
    await service.from("paie_connexions").update({ statut: "erreur" }).eq("id", connexion.id);
    return NextResponse.json({ error: `Connexion à Nethris refusée : ${err.message}` }, { status: 502 });
  }

  try {
    await nethrisPutFilePaie({ sessionId, fileName, fileContent });
  } catch (err) {
    console.error("Erreur envoi fichier Nethris:", err.message);
    return NextResponse.json({ error: `L'envoi du fichier a échoué : ${err.message}` }, { status: 502 });
  } finally {
    await nethrisLogout(sessionId);
  }

  await service.from("paie_connexions").update({ statut: "verifie" }).eq("id", connexion.id);

  return NextResponse.json({ envoye: true, apercu: totaux });
}
