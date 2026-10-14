import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { envoyerPushEmployes } from "@/lib/pushServer";
import { erreurPlage } from "@/lib/echangeQuart";
import { candidatsEligibles, plageDeLAppel, quartPasCommence } from "@/lib/remplacementServer";

function libelleDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" });
}

// Les appels de remplaçant : `ouverts` = ceux des collègues auxquels je peux répondre ; `mes` = les miens (encore ouverts).
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const { data: appels, error } = await service.from("appels_remplacant").select("*").eq("entreprise_id", employe.entreprise_id).eq("statut", "ouvert");

  // Table absente (SQL pas exécuté) : rien à afficher, sans erreur visible.
  if (error || !appels || appels.length === 0) return NextResponse.json({ ouverts: [], mes: [] });

  const { data: quarts } = await service.from("planning_quarts").select("id, date, heure_debut, heure_fin, poste, emplacement_id").in("id", appels.map((a) => a.quart_id));
  const quartPar = new Map((quarts || []).map((q) => [q.id, q]));
  const futurs = appels.filter((a) => quartPar.has(a.quart_id) && quartPasCommence(quartPar.get(a.quart_id)));

  const [{ data: employes }, { data: emplacements }] = await Promise.all([
    service.from("employes").select("id, nom").in("id", [...new Set(futurs.map((a) => a.demandeur_id))]),
    service.from("emplacements").select("id, nom").eq("entreprise_id", employe.entreprise_id),
  ]);
  const nomPar = new Map((employes || []).map((e) => [e.id, e.nom]));
  const succursalePar = new Map((emplacements || []).map((e) => [e.id, e.nom]));

  const enrichir = (a) => {
    const q = quartPar.get(a.quart_id);
    const plage = plageDeLAppel(a, q);
    return {
      id: a.id,
      demandeur: nomPar.get(a.demandeur_id) || "Collègue",
      date: q.date,
      debut: plage.debut,
      fin: plage.fin,
      poste: q.poste || null,
      succursale: succursalePar.get(q.emplacement_id) || null,
      note: a.note || null,
    };
  };

  const mes = futurs.filter((a) => a.demandeur_id === employe.id).map(enrichir);

  const ouverts = [];
  for (const a of futurs.filter((x) => x.demandeur_id !== employe.id)) {
    const eligibles = await candidatsEligibles(service, a, quartPar.get(a.quart_id), [employe.id]);
    if (eligibles.includes(employe.id)) ouverts.push(enrichir(a));
  }

  return NextResponse.json({ ouverts, mes });
}

// Lance un appel de remplaçant pour un de mes quarts (en entier ou en partie) et prévient les collègues disponibles.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { quartId, heureDebut, heureFin, note } = await request.json().catch(() => ({}));
  if (!quartId) {
    return NextResponse.json({ error: "Quart manquant." }, { status: 400 });
  }

  const service = getServiceClient();

  const { data: entreprise } = await service.from("entreprises").select("echanges_actif").eq("id", employe.entreprise_id).maybeSingle();
  if (entreprise && entreprise.echanges_actif === false) {
    return NextResponse.json({ error: "Les échanges de quart sont désactivés pour ton entreprise." }, { status: 403 });
  }

  const { data: quart } = await service.from("planning_quarts").select("*").eq("id", quartId).maybeSingle();
  if (!quart || quart.entreprise_id !== employe.entreprise_id || quart.employe_id !== employe.id || !quart.publie) {
    return NextResponse.json({ error: "Quart introuvable." }, { status: 404 });
  }
  if (!quartPasCommence(quart)) {
    return NextResponse.json({ error: "Ce quart a déjà commencé." }, { status: 400 });
  }

  // Une partie du quart seulement si les heures ne couvrent pas déjà tout le quart.
  const partiel = heureDebut && heureFin && !(heureDebut === String(quart.heure_debut).slice(0, 5) && heureFin === String(quart.heure_fin).slice(0, 5));
  if (partiel) {
    const erreur = erreurPlage(heureDebut, heureFin, quart);
    if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });
  }

  const { data: deja } = await service.from("appels_remplacant").select("id").eq("quart_id", quartId).eq("statut", "ouvert").maybeSingle();
  if (deja) {
    return NextResponse.json({ error: "Tu as déjà un appel de remplaçant pour ce quart." }, { status: 409 });
  }

  const { data: appel, error } = await service
    .from("appels_remplacant")
    .insert({
      entreprise_id: employe.entreprise_id,
      quart_id: quartId,
      demandeur_id: employe.id,
      note: typeof note === "string" && note.trim() ? note.trim().slice(0, 200) : null,
      ...(partiel ? { heure_debut: heureDebut, heure_fin: heureFin } : {}),
    })
    .select("*")
    .single();
  if (error) {
    console.error("Erreur appel de remplaçant:", error.message);
    return NextResponse.json({ error: "L'envoi a échoué (le fichier SQL appels_remplacant.sql est-il exécuté ?)." }, { status: 500 });
  }

  // Notification aux collègues qui peuvent répondre (en silence si ça échoue : l'appel est créé dans tous les cas).
  const { data: collegues } = await service.from("employes").select("id").eq("entreprise_id", employe.entreprise_id);
  const eligibles = await candidatsEligibles(service, appel, quart, (collegues || []).map((c) => c.id));
  const plage = plageDeLAppel(appel, quart);
  await envoyerPushEmployes(
    service,
    eligibles,
    { titre: "Remplaçant demandé", corps: `${employe.nom} cherche un remplaçant : ${libelleDate(quart.date)}, ${plage.debut}–${plage.fin}.`, url: "/moi/annonces" },
    "notif_echange_recu"
  ).catch((err) => console.error("Erreur notification d'appel de remplaçant:", err));

  return NextResponse.json({ ok: true, appelId: appel.id, notifies: eligibles.length });
}

// Annule un de mes appels de remplaçant encore ouverts.
export async function DELETE(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Appel manquant." }, { status: 400 });
  }

  const service = getServiceClient();
  const { error } = await service.from("appels_remplacant").delete().eq("id", id).eq("demandeur_id", employe.id).eq("statut", "ouvert");
  if (error) {
    return NextResponse.json({ error: "Impossible d'annuler cet appel." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
