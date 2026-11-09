import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { CATALOGUE_INTEGRATIONS } from "@/lib/integrationsCatalogue";

export const dynamic = "force-dynamic";

// Magasin d'intégrations : liste des intégrations « installées » d'une entreprise.
// Installée = installée explicitement (table integrations_installees) OU déjà connectée (Wix, OneDrive, Google Drive, Nethris,
// clé d'assistant IA) : ainsi rien ne disparaît chez un client qui avait déjà branché un service avant le magasin.
// Installer/retirer ne change que ce que le client voit : « retirer » ne déconnecte aucun service.
// Actions : lister | installer | retirer
export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { action, entrepriseId, integrationId } = await request.json().catch(() => ({}));

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!entreprise) return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });

  if (action === "installer" || action === "retirer") {
    const connue = CATALOGUE_INTEGRATIONS.find((i) => i.id === integrationId && i.disponible);
    if (!connue) return NextResponse.json({ error: "Intégration inconnue." }, { status: 400 });

    if (action === "installer") {
      const { error } = await service
        .from("integrations_installees")
        .upsert({ entreprise_id: entreprise.id, integration_id: connue.id }, { onConflict: "entreprise_id,integration_id" });
      if (error) {
        console.error("Erreur installation intégration:", error.message);
        return NextResponse.json({ error: "Impossible d'installer. Le SQL du magasin d'intégrations a-t-il été exécuté?" }, { status: 500 });
      }
    } else {
      const { error } = await service.from("integrations_installees").delete().eq("entreprise_id", entreprise.id).eq("integration_id", connue.id);
      if (error) return NextResponse.json({ error: "Impossible de retirer l'intégration." }, { status: 500 });
    }
  } else if (action !== "lister") {
    return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }

  // Explicites + déjà connectées.
  const installees = new Set();
  const explicites = await service.from("integrations_installees").select("integration_id").eq("entreprise_id", entreprise.id);
  for (const r of explicites.data || []) installees.add(r.integration_id);

  const [wix, stockage, paie, ia] = await Promise.all([
    service.from("wix_connexions").select("statut").eq("entreprise_id", entreprise.id).maybeSingle(),
    service.from("stockage_connexions").select("fournisseur").eq("entreprise_id", entreprise.id),
    service.from("paie_connexions").select("service").eq("entreprise_id", entreprise.id),
    service.from("ia_cles").select("id", { count: "exact", head: true }).eq("entreprise_id", entreprise.id).eq("revoquee", false),
  ]);
  if (wix.data?.statut === "connecte") installees.add("wix");
  for (const c of stockage.data || []) installees.add(c.fournisseur === "google" ? "google-drive" : "onedrive");
  for (const c of paie.data || []) if (c.service === "nethris") installees.add("nethris");
  if ((ia.count || 0) > 0) installees.add("ia-assistants");

  return NextResponse.json({ installees: [...installees], configure: !explicites.error });
}
