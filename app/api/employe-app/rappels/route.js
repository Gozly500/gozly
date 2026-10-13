import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { chargerRestrictions, peutCreerRappels } from "@/lib/chatRestrictions";
import { creerRappel } from "@/lib/rappelsServer";

// Rappels de l'employé : ceux qui lui sont destinés (`recus`, affichés en haut de l'app) et ceux qu'il a créés (`crees`).
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const maintenant = new Date().toISOString();

  const { data: actifs, error } = await service
    .from("rappels")
    .select("*")
    .eq("entreprise_id", employe.entreprise_id)
    .lte("debut", maintenant)
    .gt("fin", maintenant)
    .order("debut", { ascending: false })
    .limit(60);

  // Table absente (SQL pas exécuté) : aucun rappel, sans erreur visible.
  if (error) return NextResponse.json({ recus: [], crees: [] });

  const ids = (actifs || []).map((r) => r.id);
  const { data: destinataires } = ids.length > 0 ? await service.from("rappel_destinataires").select("rappel_id, employe_id").in("rappel_id", ids) : { data: [] };

  const pourMoi = new Set((destinataires || []).filter((d) => d.employe_id === employe.id).map((d) => d.rappel_id));
  const nbParRappel = new Map();
  for (const d of destinataires || []) nbParRappel.set(d.rappel_id, (nbParRappel.get(d.rappel_id) || 0) + 1);

  const recus = (actifs || [])
    .filter((r) => r.pour_tous || pourMoi.has(r.id))
    // Un rappel anonyme n'envoie jamais le nom de son auteur aux destinataires.
    .map((r) => ({ id: r.id, contenu: r.contenu, fin: r.fin, anonyme: !!r.anonyme, auteur: r.anonyme ? null : r.auteur_nom }));

  const crees = (actifs || [])
    .filter((r) => r.cree_par_employe === employe.id)
    .map((r) => ({ id: r.id, contenu: r.contenu, fin: r.fin, pourTous: r.pour_tous, nb: nbParRappel.get(r.id) || 0 }));

  return NextResponse.json({ recus, crees });
}

// Crée un rappel (pour tout le monde ou pour des personnes précises), si le propriétaire l'autorise.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const corps = await request.json().catch(() => ({}));
  const service = getServiceClient();

  if (!(await peutCreerRappels(service, employe.id))) {
    return NextResponse.json({ error: "La création de rappels n'est pas autorisée pour ton compte." }, { status: 403 });
  }

  const { bloques } = await chargerRestrictions(service, employe.id);
  const resultat = await creerRappel(service, {
    entrepriseId: employe.entreprise_id,
    contenu: corps.contenu,
    dureeHeures: corps.dureeHeures,
    pourTous: !!corps.pourTous,
    employeIds: corps.employeIds,
    auteur: { employeId: employe.id, nom: employe.nom },
    anonyme: !!corps.anonyme,
    bloques,
  });

  if (resultat.erreur) {
    return NextResponse.json({ error: resultat.erreur }, { status: resultat.statut });
  }
  return NextResponse.json({ ok: true, rappelId: resultat.rappel.id });
}

// Retire un rappel que l'employé a lui-même créé.
export async function DELETE(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Rappel manquant." }, { status: 400 });
  }

  const service = getServiceClient();
  const { error } = await service.from("rappels").delete().eq("id", id).eq("cree_par_employe", employe.id);
  if (error) {
    return NextResponse.json({ error: "Impossible de retirer ce rappel." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
