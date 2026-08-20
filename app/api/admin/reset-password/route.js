import { NextResponse } from "next/server";
import { requireAdmin, getServiceClient, generatePassword } from "@/lib/adminServer";

export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const serviceClient = getServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  const { userId } = await request.json().catch(() => ({}));
  if (!userId) {
    return NextResponse.json({ error: "userId manquant." }, { status: 400 });
  }

  const newPassword = generatePassword();
  const { error } = await serviceClient.auth.admin.updateUserById(userId, { password: newPassword });

  if (error) {
    return NextResponse.json({ error: "La réinitialisation a échoué : " + error.message }, { status: 500 });
  }

  return NextResponse.json({ password: newPassword });
}
