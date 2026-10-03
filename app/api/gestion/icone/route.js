import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";
import { getServiceClient } from "@/lib/adminServer";

// Icône de l'app "Gozly Gestion" aux couleurs du compte : le logo de l'entreprise,
// centré sur fond blanc avec de la marge (zone de sécurité des icônes "maskable").
// Si l'entreprise n'a pas de logo, ou s'il est dans un format que le rendu ne lit
// pas (WebP), on affiche l'icône Gozly par défaut.
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

  let logo = null;
  const service = getServiceClient();
  if (service && entrepriseId) {
    const { data } = await service.from("entreprises").select("nom, logo_url").eq("id", entrepriseId).maybeSingle();
    if (data) {
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

  // Icône Gozly par défaut (même fichier que l'icône de l'app employé).
  const svg = await readFile(join(process.cwd(), "public", "gozly-app-icon.svg"), "utf8");
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri} width={taille} height={taille} alt="" />
      </div>
    ),
    { width: taille, height: taille, headers: entetes }
  );
}
