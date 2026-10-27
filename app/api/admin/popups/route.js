import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminServer";
import { db } from "@/lib/annoncesSite";
import { CIBLES_POPUP, LIMITES_POPUP } from "@/lib/popupsServer";

export const dynamic = "force-dynamic";

const messageTable = (error) =>
  /popups_app|popups_vus/.test(error?.message || "") ? "La base n'est pas prête (SQL popups_app.sql à exécuter)." : error?.message || "Erreur.";

// GET : tous les pop-ups (actifs et brouillons) avec le nombre de personnes qui les ont déjà vus.
export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = db();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });

  const { data, error } = await service.from("popups_app").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });

  const { data: vus } = await service.from("popups_vus").select("popup_id").limit(50000);
  const compte = {};
  for (const v of vus || []) compte[v.popup_id] = (compte[v.popup_id] || 0) + 1;
  return NextResponse.json({ popups: (data || []).map((p) => ({ ...p, vus: compte[p.id] || 0 })) });
}

// POST { action: "creer" | "modifier" | "activer" | "desactiver" | "reafficher" | "supprimer", id?, titre, contenu, cibles }
//   reafficher : efface « déjà vu » : tout le monde le revoit à sa prochaine ouverture de l'app.
export async function POST(request) {
  const { errorStatus, errorMessage, user } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = db();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });

  const c = await request.json().catch(() => ({}));
  const fin = (error) => (error ? NextResponse.json({ error: messageTable(error) }, { status: 500 }) : NextResponse.json({ ok: true }));

  if (c.action === "supprimer") {
    if (!c.id) return NextResponse.json({ error: "id manquant." }, { status: 400 });
    return fin((await service.from("popups_app").delete().eq("id", c.id)).error);
  }
  if (c.action === "activer" || c.action === "desactiver") {
    if (!c.id) return NextResponse.json({ error: "id manquant." }, { status: 400 });
    const champs = c.action === "activer" ? { actif: true, active_le: new Date().toISOString() } : { actif: false };
    return fin((await service.from("popups_app").update({ ...champs, maj: new Date().toISOString() }).eq("id", c.id)).error);
  }
  if (c.action === "reafficher") {
    if (!c.id) return NextResponse.json({ error: "id manquant." }, { status: 400 });
    return fin((await service.from("popups_vus").delete().eq("popup_id", c.id)).error);
  }
  if (c.action !== "creer" && c.action !== "modifier") return NextResponse.json({ error: "Action inconnue." }, { status: 400 });

  const titre = String(c.titre || "").trim();
  const contenu = String(c.contenu || "").trim();
  const cibles = (Array.isArray(c.cibles) ? c.cibles : []).filter((x) => CIBLES_POPUP.includes(x));
  if (!titre) return NextResponse.json({ error: "Le titre est obligatoire." }, { status: 400 });
  if (titre.length > LIMITES_POPUP.titre) return NextResponse.json({ error: `Titre trop long (maximum ${LIMITES_POPUP.titre} caractères).` }, { status: 400 });
  if (contenu.length > LIMITES_POPUP.contenu) return NextResponse.json({ error: `Texte trop long (maximum ${LIMITES_POPUP.contenu} caractères).` }, { status: 400 });
  if (cibles.length === 0) return NextResponse.json({ error: "Choisis qui doit voir ce pop-up." }, { status: 400 });

  if (c.action === "modifier") {
    if (!c.id) return NextResponse.json({ error: "id manquant." }, { status: 400 });
    return fin((await service.from("popups_app").update({ titre, contenu, cibles, maj: new Date().toISOString() }).eq("id", c.id)).error);
  }
  const actif = !!c.activer;
  return fin((await service.from("popups_app").insert({ titre, contenu, cibles, actif, active_le: actif ? new Date().toISOString() : null, cree_par: user?.email || null })).error);
}
