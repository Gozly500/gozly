import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { verifierAppelApp } from "@/lib/appApi";
import { outilsPourApp, appelerOutilApp } from "@/lib/iaServer";

export const dynamic = "force-dynamic";

function refuser(erreur) {
  const headers = erreur.retry ? { "Retry-After": String(erreur.retry) } : undefined;
  return NextResponse.json({ error: erreur.message }, { status: erreur.status, headers });
}

// API des apps de développeurs. Authentification : Authorization: Bearer <clé de l'app> + X-Gozly-Entreprise: <id>.
// GET : outils permis à l'app (selon les permissions confirmées à l'installation). POST { outil, args } : exécute un outil.
export async function GET(request) {
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
  const v = await verifierAppelApp(service, request);
  if (v.erreur) return refuser(v.erreur);
  return NextResponse.json({ outils: outilsPourApp(v.app.permissions) });
}

export async function POST(request) {
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
  const v = await verifierAppelApp(service, request);
  if (v.erreur) return refuser(v.erreur);
  const { outil, args } = await request.json().catch(() => ({}));
  if (typeof outil !== "string") return NextResponse.json({ error: "Le champ « outil » est requis." }, { status: 400 });
  const r = await appelerOutilApp(service, v.entrepriseId, v.app.permissions, outil, args);
  if (r.erreur) return NextResponse.json({ error: r.erreur }, { status: 400 });
  return NextResponse.json({ resultat: r.contenu });
}
