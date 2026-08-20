import { NextResponse } from "next/server";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";

export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const serviceClient = getServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  const { data: entreprises } = await serviceClient
    .from("entreprises")
    .select("*")
    .order("created_at", { ascending: false });
  const { data: profils } = await serviceClient.from("profils").select("*");

  // Le courriel de connexion vit dans auth.users, invisible depuis les
  // tables normales - seule l'API admin peut le lire.
  const { data: usersPage } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((usersPage?.users || []).map((u) => [u.id, u.email]));

  const rows = (entreprises || []).map((entreprise) => {
    const profil = (profils || []).find((p) => p.entreprise_id === entreprise.id) || null;
    return {
      entreprise,
      profil,
      email: profil ? emailById.get(profil.id) || null : null,
    };
  });

  return NextResponse.json({ rows });
}

export async function PATCH(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const serviceClient = getServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { profilId, entrepriseId, fullName, telephonePerso, entrepriseNom, telephone, courrielContact, adresse, email } =
    body;

  if (profilId) {
    await serviceClient
      .from("profils")
      .update({ full_name: fullName ?? null, telephone_perso: telephonePerso || null })
      .eq("id", profilId);

    if (email) {
      const { error: emailError } = await serviceClient.auth.admin.updateUserById(profilId, {
        email,
        email_confirm: true,
      });
      if (emailError) {
        return NextResponse.json(
          { error: "Les infos ont été mises à jour, mais le courriel n'a pas pu être changé : " + emailError.message },
          { status: 400 }
        );
      }
    }
  }

  if (entrepriseId) {
    await serviceClient
      .from("entreprises")
      .update({
        nom: entrepriseNom ?? null,
        telephone: telephone || null,
        courriel_contact: courrielContact || null,
        adresse: adresse || null,
      })
      .eq("id", entrepriseId);
  }

  return NextResponse.json({ success: true });
}
