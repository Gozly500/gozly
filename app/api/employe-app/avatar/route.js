import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { normaliserAvatar } from "@/lib/avatar";

// Avatar de l'employé connecté : lecture et sauvegarde (supabase/avatars.sql).
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  return NextResponse.json({ nom: employe.nom, avatar: normaliserAvatar(employe.avatar) });
}

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const { avatar } = await request.json().catch(() => ({}));
  const propre = normaliserAvatar(avatar);
  if (!propre) return NextResponse.json({ error: "Avatar invalide." }, { status: 400 });

  const service = getServiceClient();
  const { error } = await service.from("employes").update({ avatar: propre }).eq("id", employe.id);
  if (error) {
    console.error("Erreur sauvegarde avatar:", error.message);
    return NextResponse.json({ error: "Impossible d'enregistrer l'avatar (le fichier SQL avatars.sql est-il exécuté ?)." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, avatar: propre });
}
