import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { aujourdhuiLocal } from "@/lib/dates";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function emplacementsDeLEmploye(service, employeId) {
  const { data: associations } = await service
    .from("employe_emplacements")
    .select("emplacement_id")
    .eq("employe_id", employeId);
  const ids = (associations || []).map((a) => a.emplacement_id);
  if (ids.length === 0) return [];
  const { data: emplacements } = await service.from("emplacements").select("id, nom").in("id", ids);
  return emplacements || [];
}

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();

  const emplacements = await emplacementsDeLEmploye(service, employe.id);
  if (emplacements.length === 0) {
    return NextResponse.json({ taches: [], categories: [], emplacements: [] });
  }

  const dateParam = new URL(request.url).searchParams.get("date");
  const date = dateParam && DATE_REGEX.test(dateParam) ? dateParam : aujourdhuiLocal();

  const [{ data: taches }, { data: categories }] = await Promise.all([
    service
      .from("taches")
      .select("id, texte, terminee, categorie:categorie_id(id, nom)")
      .eq("entreprise_id", employe.entreprise_id)
      .eq("date", date)
      .in("emplacement_id", emplacements.map((e) => e.id))
      .order("created_at", { ascending: true }),
    service.from("categories").select("id, nom").eq("entreprise_id", employe.entreprise_id).order("nom", { ascending: true }),
  ]);

  return NextResponse.json({ taches: taches || [], categories: categories || [], emplacements });
}

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { texte, categorie_id, date, emplacement_id } = await request.json().catch(() => ({}));
  const texteNettoye = typeof texte === "string" ? texte.trim() : "";
  if (!texteNettoye || texteNettoye.length > 200) {
    return NextResponse.json({ error: "Nom de tâche invalide." }, { status: 400 });
  }
  if (typeof date !== "string" || !DATE_REGEX.test(date)) {
    return NextResponse.json({ error: "Date invalide." }, { status: 400 });
  }

  const service = getServiceClient();

  const emplacements = await emplacementsDeLEmploye(service, employe.id);
  const emplacementId = emplacement_id || emplacements[0]?.id;
  if (!emplacementId || !emplacements.some((e) => e.id === emplacementId)) {
    return NextResponse.json({ error: "Succursale invalide." }, { status: 400 });
  }

  let categorieId = null;
  if (categorie_id) {
    const { data: categorie } = await service
      .from("categories")
      .select("id")
      .eq("id", categorie_id)
      .eq("entreprise_id", employe.entreprise_id)
      .maybeSingle();
    if (!categorie) {
      return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
    }
    categorieId = categorie.id;
  }

  const { data: tache, error } = await service
    .from("taches")
    .insert({
      entreprise_id: employe.entreprise_id,
      categorie_id: categorieId,
      date,
      texte: texteNettoye,
      emplacement_id: emplacementId,
    })
    .select("id, texte, terminee, categorie:categorie_id(id, nom)")
    .single();

  if (error) {
    return NextResponse.json({ error: "Impossible d'ajouter la tâche." }, { status: 500 });
  }

  return NextResponse.json({ tache });
}
