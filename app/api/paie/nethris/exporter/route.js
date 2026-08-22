import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntreprise } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";

// Agrège les heures pointées d'une semaine par employé (régulières jusqu'à
// 40h, supplémentaires au-delà) - même logique que l'export CSV manuel côté
// client, reprise ici pour le futur envoi automatique.
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
    return NextResponse.json({ error: "Nethris n'est pas connecté. Va dans Paramètres → Intégrations." }, { status: 400 });
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

  // Les identifiants de connexion (connexion.code_entreprise,
  // connexion.code_utilisateur, decrypt(connexion.mot_de_passe_chiffre) -
  // voir lib/paieCrypto.js) sont prêts, mais l'appel réel à l'API Nethris
  // (endpoint + format de payload exacts pour soumettre `totaux`) n'est pas
  // encore documenté de notre côté - voir dev.nethris.com.
  // TODO: une fois la doc obtenue, remplacer ce bloc par le vrai fetch()
  // vers https://api.nethris.com/HC/Payroll/...

  return NextResponse.json(
    {
      error:
        "L'envoi automatique vers Nethris n'est pas encore branché - utilise l'export CSV en attendant.",
      apercu: totaux,
    },
    { status: 501 }
  );
}
