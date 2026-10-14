import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { envoyerPushEmployes } from "@/lib/pushServer";
import { appliquerEchangeQuart } from "@/lib/echangeQuart";
import { candidatsEligibles, plageDeLAppel, quartPasCommence } from "@/lib/remplacementServer";

// « Je prends » : le premier collègue disponible obtient le quart (ou la partie du quart). Ça crée une demande
// d'échange déjà acceptée des deux côtés : elle s'applique tout de suite si les échanges sont en approbation
// automatique, sinon elle attend l'approbation du gestionnaire (onglet Demandes), comme un échange normal.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { appelId } = await request.json().catch(() => ({}));
  if (!appelId) {
    return NextResponse.json({ error: "Appel manquant." }, { status: 400 });
  }

  const service = getServiceClient();

  const { data: entreprise } = await service.from("entreprises").select("echanges_actif, auto_approuver_echanges").eq("id", employe.entreprise_id).maybeSingle();
  if (entreprise && entreprise.echanges_actif === false) {
    return NextResponse.json({ error: "Les échanges de quart sont désactivés pour ton entreprise." }, { status: 403 });
  }

  const { data: appel } = await service.from("appels_remplacant").select("*").eq("id", appelId).eq("entreprise_id", employe.entreprise_id).maybeSingle();
  if (!appel || appel.statut !== "ouvert") {
    return NextResponse.json({ error: "Quelqu'un l'a déjà pris, ou l'appel a été annulé." }, { status: 409 });
  }
  if (appel.demandeur_id === employe.id) {
    return NextResponse.json({ error: "C'est ton propre appel." }, { status: 400 });
  }

  const { data: quart } = await service.from("planning_quarts").select("*").eq("id", appel.quart_id).maybeSingle();
  if (!quart || !quartPasCommence(quart)) {
    return NextResponse.json({ error: "Ce quart a déjà commencé." }, { status: 400 });
  }

  const eligibles = await candidatsEligibles(service, appel, quart, [employe.id]);
  if (!eligibles.includes(employe.id)) {
    return NextResponse.json({ error: "Tu ne peux pas prendre ce quart (tu travailles déjà à ce moment-là, ou ce n'est pas ta succursale)." }, { status: 403 });
  }

  // On le réserve d'abord (une seule personne peut réussir) : « premier arrivé, premier servi ».
  const { data: reserve } = await service
    .from("appels_remplacant")
    .update({ statut: "pris", repreneur_id: employe.id, pris_le: new Date().toISOString() })
    .eq("id", appelId)
    .eq("statut", "ouvert")
    .select("id")
    .maybeSingle();
  if (!reserve) {
    return NextResponse.json({ error: "Quelqu'un l'a déjà pris." }, { status: 409 });
  }

  const auto = !!entreprise?.auto_approuver_echanges;
  const plage = plageDeLAppel(appel, quart);
  const partiel = !!(appel.heure_debut && appel.heure_fin);

  const { data: demande, error } = await service
    .from("demandes_echange")
    .insert({
      entreprise_id: employe.entreprise_id,
      quart_id: quart.id,
      employe_donneur_id: appel.demandeur_id,
      employe_receveur_id: employe.id,
      statut_employe: "accepte",
      statut_admin: auto ? "non_requis" : "en_attente",
      traite_le: new Date().toISOString(),
      ...(partiel ? { heure_debut: appel.heure_debut, heure_fin: appel.heure_fin } : {}),
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erreur création de l'échange (appel de remplaçant):", error.message);
    // On rend l'appel disponible : la demande n'a pas pu être créée.
    await service.from("appels_remplacant").update({ statut: "ouvert", repreneur_id: null, pris_le: null }).eq("id", appelId);
    return NextResponse.json({ error: "La demande a échoué. Réessaie." }, { status: 500 });
  }

  if (auto) await appliquerEchangeQuart(service, demande);

  await envoyerPushEmployes(
    service,
    [appel.demandeur_id],
    {
      titre: "Remplaçant trouvé",
      corps: auto ? `${employe.nom} prend ton quart (${plage.debut}–${plage.fin}).` : `${employe.nom} prend ton quart (${plage.debut}–${plage.fin}). En attente de l'approbation du gestionnaire.`,
      url: "/moi/demandes",
    },
    "notif_echange_traite"
  ).catch((err) => console.error("Erreur notification (remplaçant trouvé):", err));

  return NextResponse.json({ ok: true, approuve: auto });
}
