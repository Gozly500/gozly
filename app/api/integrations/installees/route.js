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

  // Apps approuvées de développeurs (id « app:<uuid> »).
  const { data: appsApprouvees } = await service.from("apps_developpeur").select("*").eq("statut", "approuvee");
  const idsApps = new Set((appsApprouvees || []).map((a) => `app:${a.id}`));
  // Sans propriétaire (compte supprimé) : plus installable, mais elle continue chez les entreprises qui l'ont déjà.
  const idsInstallables = new Set((appsApprouvees || []).filter((a) => a.proprietaire_id).map((a) => `app:${a.id}`));

  if (action === "installer" || action === "retirer") {
    const estApp = typeof integrationId === "string" && integrationId.startsWith("app:");
    const connue = estApp
      ? action === "retirer" || idsInstallables.has(integrationId)
        ? { id: integrationId }
        : null
      : CATALOGUE_INTEGRATIONS.find((i) => i.id === integrationId && i.disponible);
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
  // Une app qui n'est plus approuvée disparaît de la liste (sans être effacée : elle revient si elle est réapprouvée).
  for (const r of explicites.data || []) if (!r.integration_id.startsWith("app:") || idsApps.has(r.integration_id)) installees.add(r.integration_id);

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

  // Noms des développeurs (la fiche publique d'une app : pas d'adresses techniques).
  const { data: profils } = await service.from("profils").select("id, full_name");
  const noms = new Map((profils || []).map((p) => [p.id, p.full_name]));
  const apps = (appsApprouvees || [])
    .filter((a) => a.proprietaire_id || installees.has(`app:${a.id}`))
    .map((a) => ({
    id: a.id,
    nom: a.nom,
    categorie: a.categorie,
    description_courte: a.description_courte,
    description_longue: a.description_longue,
    icone: a.icone,
    courriel_support: a.courriel_support,
    url_confidentialite: a.url_confidentialite,
    payant: a.payant,
    prix: a.prix,
    permissions: a.permissions || [],
    a_page: !!a.url_page,
    developpeur: a.proprietaire_id ? noms.get(a.proprietaire_id) || "" : "",
  }));

  return NextResponse.json({ installees: [...installees], apps, configure: !explicites.error });
}
