import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

// Émoji de profil de l'employé connecté (supabase/employe_emoji.sql). GET : le lire ; POST avec `emoji: null` : le retirer.
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  return NextResponse.json({ nom: employe.nom, emoji: employe.emoji || null });
}

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const { emoji } = await request.json().catch(() => ({}));
  let valeur = null;
  if (emoji !== null && emoji !== undefined) {
    // Un seul émoji : du pictogramme (avec ses variantes/liaisons), jamais du texte libre.
    if (typeof emoji !== "string" || emoji.length === 0 || emoji.length > 16 || !/^\p{Extended_Pictographic}/u.test(emoji) || /[A-Za-z0-9<>&"']/.test(emoji)) {
      return NextResponse.json({ error: "Émoji invalide." }, { status: 400 });
    }
    valeur = emoji;
  }

  const service = getServiceClient();
  const { error } = await service.from("employes").update({ emoji: valeur }).eq("id", employe.id);
  if (error) {
    console.error("Erreur sauvegarde émoji:", error.message);
    return NextResponse.json({ error: "Impossible d'enregistrer l'émoji (le fichier SQL employe_emoji.sql est-il exécuté ?)." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, emoji: valeur });
}
