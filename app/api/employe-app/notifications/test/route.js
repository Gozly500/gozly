import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { envoyerTestPush } from "@/lib/pushServer";
import { enHeuresCalmes } from "@/lib/heuresCalmes";

// Diagnostic des notifications de l'employé : envoie un test à son appareil et renvoie ce que le serveur sait
// (abonnement connu, réponse du service de notification, heures calmes, préférence « messages »).
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const { endpoint } = await request.json().catch(() => ({}));
  const service = getServiceClient();

  const test = await envoyerTestPush(service, employe.id, typeof endpoint === "string" ? endpoint : null);

  const { data: prefs } = await service.from("employes").select("notif_messages").eq("id", employe.id).maybeSingle();
  let heuresCalmes = false;
  const { data: calmes, error: erreurCalmes } = await service
    .from("employes")
    .select("heures_calmes_actif, heures_calmes_debut, heures_calmes_fin")
    .eq("id", employe.id)
    .maybeSingle();
  if (!erreurCalmes && calmes) heuresCalmes = enHeuresCalmes(calmes);

  return NextResponse.json({ ...test, notifMessages: prefs?.notif_messages !== false, heuresCalmes });
}
