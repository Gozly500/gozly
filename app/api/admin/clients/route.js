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
  // "membres" est la source de vérité du lien compte <-> entreprise(s) - un
  // compte peut posséder ou appartenir à plusieurs entreprises séparées
  // (ex: deux succursales immatriculées différemment). "profils.entreprise_id"
  // ne retient que la toute première entreprise créée à l'inscription, donc ne
  // suffit plus pour retrouver les entreprises créées ensuite (voir
  // CreerEntrepriseModal.jsx) - d'où l'utilisation de "membres" ici.
  const { data: membres } = await serviceClient.from("membres").select("entreprise_id, user_id, role");

  // Le courriel de connexion vit dans auth.users, invisible depuis les
  // tables normales - seule l'API admin peut le lire.
  const { data: usersPage } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((usersPage?.users || []).map((u) => [u.id, u.email]));
  const profilById = new Map((profils || []).map((p) => [p.id, p]));
  const entrepriseById = new Map((entreprises || []).map((e) => [e.id, e]));

  // Regroupe par compte (un profil = un compte de connexion), chacun avec la
  // liste de ses entreprises. Les entreprises sans aucun membre (ne devrait
  // pas arriver, mais on ne veut jamais les faire disparaître silencieusement)
  // sont listées à part.
  const comptes = new Map();
  const entrepriseIdsAvecMembre = new Set();

  for (const m of membres || []) {
    const entreprise = entrepriseById.get(m.entreprise_id);
    if (!entreprise) continue;
    entrepriseIdsAvecMembre.add(entreprise.id);

    const profil = profilById.get(m.user_id) || null;
    if (!comptes.has(m.user_id)) {
      comptes.set(m.user_id, {
        userId: m.user_id,
        profil,
        email: profil ? emailById.get(profil.id) || null : emailById.get(m.user_id) || null,
        entreprises: [],
      });
    }
    comptes.get(m.user_id).entreprises.push({ entreprise, role: m.role });
  }

  const entreprisesOrphelines = (entreprises || []).filter((e) => !entrepriseIdsAvecMembre.has(e.id));

  return NextResponse.json({
    comptes: [...comptes.values()].sort((a, b) => {
      const da = a.entreprises[0]?.entreprise.created_at || "";
      const db = b.entreprises[0]?.entreprise.created_at || "";
      return da < db ? 1 : -1;
    }),
    entreprisesOrphelines,
  });
}

export async function PATCH(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const serviceClient = getServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    profilId,
    entrepriseId,
    fullName,
    telephonePerso,
    entrepriseNom,
    telephone,
    courrielContact,
    adresse,
    // Géocodées côté client (voir lib/geocode.js, même mécanisme que pour les
    // succursales) avant l'appel - undefined si l'adresse n'a pas changé, pour
    // ne pas écraser des coordonnées déjà valides.
    latitude,
    longitude,
    email,
  } = body;

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
    const champs = {
      nom: entrepriseNom ?? null,
      telephone: telephone || null,
      courriel_contact: courrielContact || null,
      adresse: adresse || null,
    };
    if (latitude !== undefined) champs.latitude = latitude;
    if (longitude !== undefined) champs.longitude = longitude;

    await serviceClient.from("entreprises").update(champs).eq("id", entrepriseId);
  }

  return NextResponse.json({ success: true });
}
