import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";

// Manifeste de l'app "Gozly Gestion" propre à une entreprise : son nom et son logo
// comme nom et icône de l'app sur l'écran d'accueil. Référencé par GestionShell
// une fois l'entreprise connue (l'installation se fait après la connexion).
export async function GET(request) {
  const entrepriseId = new URL(request.url).searchParams.get("e");

  let nom = "";
  const service = getServiceClient();
  if (service && entrepriseId) {
    const { data } = await service.from("entreprises").select("nom").eq("id", entrepriseId).maybeSingle();
    nom = data?.nom || "";
  }

  const param = entrepriseId ? `e=${encodeURIComponent(entrepriseId)}&` : "";
  const manifeste = {
    name: nom ? `${nom} – Gestion` : "Gozly Gestion",
    short_name: nom ? nom.slice(0, 12) : "Gozly Gestion",
    description: "Ton tableau de bord, version téléphone : heures, commandes et demandes.",
    start_url: "/gestion",
    scope: "/gestion",
    display: "standalone",
    background_color: "#0d0d3f",
    theme_color: "#191960",
    icons: [
      { src: `/api/gestion/icone?${param}taille=192`, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: `/api/gestion/icone?${param}taille=512`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };

  return new NextResponse(JSON.stringify(manifeste), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" },
  });
}
