import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { genererCle } from "@/lib/iaServer";
import { aAuMoinsUnDroit, normaliserDroits } from "@/lib/iaModules";

export const dynamic = "force-dynamic";

const MAX_CLES = 10;

// Gestion des clés IA d'une entreprise (Paramètres > Intégrations > Intelligence artificielle).
// Réservé au PROPRIÉTAIRE de l'entreprise : une clé donne accès aux données de l'entreprise.
// Actions : lister | creer | revoquer | journal
export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { action, entrepriseId, nom, ecriture, cleId, droits: droitsBruts } = await request.json().catch(() => ({}));

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!entreprise) return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });

  const { data: membre } = await service
    .from("membres")
    .select("role")
    .eq("entreprise_id", entreprise.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membre?.role !== "proprietaire") {
    return NextResponse.json({ error: "Seul le propriétaire de l'entreprise peut gérer les connexions IA." }, { status: 403 });
  }

  if (action === "lister") {
    const { data, error } = await service
      .from("ia_cles")
      .select("id, nom, prefixe, ecriture, derniere_utilisation, revoquee, created_at, oauth, client_nom, refresh_expire_le, droits")
      .eq("entreprise_id", entreprise.id)
      .eq("revoquee", false)
      .order("created_at", { ascending: false });
    if (error) {
      // Colonnes OAuth absentes (ia_oauth.sql pas encore exécuté) : on relit sans elles. Table absente : ia_connexions.sql pas exécuté.
      const base = await service
        .from("ia_cles")
        .select("id, nom, prefixe, ecriture, derniere_utilisation, revoquee, created_at")
        .eq("entreprise_id", entreprise.id)
        .eq("revoquee", false)
        .order("created_at", { ascending: false });
      if (base.error) return NextResponse.json({ cles: [], configure: false });
      return NextResponse.json({ cles: base.data || [], configure: true });
    }
    // Une connexion OAuth dont le jeton de renouvellement est expiré n'est plus utilisable : on ne l'affiche plus.
    const actives = (data || []).filter((c) => !c.oauth || !c.refresh_expire_le || new Date(c.refresh_expire_le) > new Date());
    return NextResponse.json({ cles: actives, configure: true });
  }

  if (action === "creer") {
    const nomPropre = String(nom || "").trim().slice(0, 60);
    if (!nomPropre) return NextResponse.json({ error: "Donne un nom à cette connexion (ex: « ChatGPT de Marie »)." }, { status: 400 });

    const { count } = await service.from("ia_cles").select("id", { count: "exact", head: true }).eq("entreprise_id", entreprise.id).eq("revoquee", false).eq("oauth", false);
    if ((count || 0) >= MAX_CLES) return NextResponse.json({ error: `Maximum ${MAX_CLES} connexions actives : révoque-en une d'abord.` }, { status: 400 });

    // Droits par module (sinon l'ancien réglage : horaire en lecture, ou en écriture si la case était cochée).
    const droits = normaliserDroits(droitsBruts ?? { horaire: ecriture ? "ecriture" : "lecture" });
    if (!aAuMoinsUnDroit(droits)) return NextResponse.json({ error: "Choisis au moins un module." }, { status: 400 });

    const { cle, hash, prefixe } = genererCle();
    const { error } = await service.from("ia_cles").insert({
      entreprise_id: entreprise.id,
      nom: nomPropre,
      prefixe,
      cle_hash: hash,
      ecriture: droits.horaire === "ecriture",
      droits,
      cree_par: user.id,
    });
    if (error) {
      console.error("Erreur création clé IA:", error.message);
      return NextResponse.json({ error: "Impossible de créer la clé. Le SQL des connexions IA a-t-il été exécuté?" }, { status: 500 });
    }
    // La clé complète n'est retournée qu'ici, une seule fois : on ne garde que son empreinte.
    return NextResponse.json({ ok: true, cle });
  }

  if (action === "revoquer") {
    const { error } = await service.from("ia_cles").update({ revoquee: true }).eq("id", cleId).eq("entreprise_id", entreprise.id);
    if (error) return NextResponse.json({ error: "Impossible de révoquer la clé." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "journal") {
    const { data } = await service
      .from("ia_journal")
      .select("id, outil, resume, ok, created_at")
      .eq("entreprise_id", entreprise.id)
      .eq("cle_id", cleId)
      .order("created_at", { ascending: false })
      .limit(30);
    return NextResponse.json({ journal: data || [] });
  }

  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}
