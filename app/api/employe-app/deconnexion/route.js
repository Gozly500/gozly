import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, hashToken } from "@/lib/employeSession";

export async function POST(request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: true });
  }

  const service = getServiceClient();
  if (service) {
    await service.from("employe_sessions").delete().eq("token_hash", hashToken(token));
  }

  return NextResponse.json({ ok: true });
}
