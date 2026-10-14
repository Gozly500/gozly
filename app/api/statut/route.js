import { NextResponse } from "next/server";
import { calculerStatut } from "@/lib/statutServer";

export const dynamic = "force-dynamic";

// Public : état de tous les systèmes (détection auto + surcharges manuelles de l'admin).
export async function GET(request) {
  const statut = await calculerStatut(new URL(request.url).origin);
  return NextResponse.json(statut, { headers: { "Cache-Control": "no-store" } });
}
