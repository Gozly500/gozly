import { ImageResponse } from "next/og";
import { getServiceClient } from "@/lib/adminServer";

// Icône de l'app "Gozly Gestion" aux couleurs du compte : le logo de l'entreprise,
// centré sur fond blanc avec de la marge (zone de sécurité des icônes "maskable").
// Si l'entreprise n'a pas de logo, ou s'il est dans un format que le rendu ne lit
// pas (WebP), on affiche l'initiale de l'entreprise sur le dégradé Gozly.
const FORMATS_LUS = ["image/png", "image/jpeg", "image/gif"];

async function chargerLogo(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!FORMATS_LUS.includes(type)) return null;
    const octets = Buffer.from(await res.arrayBuffer());
    if (octets.length > 4 * 1024 * 1024) return null;
    return `data:${type};base64,${octets.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const entrepriseId = params.get("e");
  const taille = params.get("taille") === "512" ? 512 : 192;

  let nom = "G";
  let logo = null;
  const service = getServiceClient();
  if (service && entrepriseId) {
    const { data } = await service.from("entreprises").select("nom, logo_url").eq("id", entrepriseId).maybeSingle();
    if (data) {
      nom = data.nom || "G";
      if (data.logo_url) logo = await chargerLogo(data.logo_url);
    }
  }

  const entetes = { "Cache-Control": "public, max-age=3600, s-maxage=3600" };

  if (logo) {
    const cote = Math.round(taille * 0.66);
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={cote} height={cote} style={{ objectFit: "contain" }} alt="" />
        </div>
      ),
      { width: taille, height: taille, headers: entetes }
    );
  }

  const initiale = (nom.trim()[0] || "G").toUpperCase();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(150deg, #7a3fe0, #221f8a)",
          color: "#ffffff",
          fontSize: Math.round(taille * 0.5),
          fontWeight: 700,
        }}
      >
        {initiale}
      </div>
    ),
    { width: taille, height: taille, headers: entetes }
  );
}
