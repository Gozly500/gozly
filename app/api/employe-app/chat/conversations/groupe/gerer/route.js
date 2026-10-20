import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { chargerRestrictions, auMoinsUnePaireBloquee } from "@/lib/chatRestrictions";
import { employesAvecAvatar, profilsAvecAvatar } from "@/lib/avatarServeur";

// Gestion d'un groupe de discussion par ses membres (supabase/chat_groupes_gestion.sql) :
//   GET  ?conversationId=…  -> membres (tout membre peut voir qui est dans le groupe)
//   POST { conversationId, action: "ajouter" | "retirer" | "admin" | "quitter", … }
// Règles : tout membre peut ajouter des collègues ; seuls les administrateurs retirent un membre ou nomment un
// administrateur ; chacun peut quitter. Si le dernier administrateur part, le membre le plus ancien le devient ;
// quand la dernière personne part, le groupe est supprimé. Les gens du tableau de bord ne sont jamais retirés d'ici.
const MAX_MEMBRES = 50;
const ERREUR_SQL = "Cette fonction demande d'exécuter le fichier SQL chat_groupes_gestion.sql.";

function fautSql(error) {
  return !!error && /est_admin|ajoute_le|systeme|column/i.test(error.message || "");
}

async function contexte(request, conversationId) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return { reponse: NextResponse.json({ error: "Session invalide." }, { status: 401 }) };
  if (!conversationId) return { reponse: NextResponse.json({ error: "Conversation manquante." }, { status: 400 }) };

  const service = getServiceClient();
  const { data: conversation } = await service.from("conversations").select("id, type, entreprise_id").eq("id", conversationId).maybeSingle();
  if (!conversation || conversation.type !== "groupe" || conversation.entreprise_id !== employe.entreprise_id) {
    return { reponse: NextResponse.json({ error: "Groupe introuvable." }, { status: 404 }) };
  }

  const { data: lignes, error } = await service
    .from("conversation_participants")
    .select("id, employe_id, user_id, est_admin, ajoute_le")
    .eq("conversation_id", conversationId);
  if (error) {
    return { reponse: NextResponse.json({ error: fautSql(error) ? ERREUR_SQL : "Chargement impossible." }, { status: 500 }) };
  }
  const membres = lignes || [];
  if (!membres.some((p) => p.employe_id === employe.id)) {
    return { reponse: NextResponse.json({ error: "Accès refusé." }, { status: 403 }) };
  }

  // Groupe créé avant les rôles (aucun administrateur) : le membre le plus ancien l'est, et on le mémorise.
  // S'il y a des gens du tableau de bord dans le groupe, ils gèrent le groupe de leur côté : personne à élire.
  if (!membres.some((p) => p.est_admin || p.user_id)) {
    // Le créateur n'est pas enregistré pour ces anciens groupes : on choisit l'auteur du premier message (souvent lui),
    // sinon le membre le plus ancien.
    const { data: premier } = await service
      .from("messages")
      .select("employe_id")
      .eq("conversation_id", conversationId)
      .not("employe_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(1);
    const auteur = membres.find((p) => p.employe_id && p.employe_id === premier?.[0]?.employe_id);
    const elu = auteur || [...membres].sort((a, b) => String(a.ajoute_le).localeCompare(String(b.ajoute_le)) || String(a.id).localeCompare(String(b.id)))[0];
    if (elu) {
      elu.est_admin = true;
      await service.from("conversation_participants").update({ est_admin: true }).eq("id", elu.id);
    }
  }

  return { employe, service, membres };
}

async function messageSysteme(service, conversationId, employeId, systeme, contenu) {
  await service.from("messages").insert({ conversation_id: conversationId, employe_id: employeId, contenu, systeme });
}

export async function GET(request) {
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  const ctx = await contexte(request, conversationId);
  if (ctx.reponse) return ctx.reponse;
  const { employe, service, membres } = ctx;

  const employeIds = membres.filter((p) => p.employe_id).map((p) => p.employe_id);
  const userIds = membres.filter((p) => p.user_id).map((p) => p.user_id);
  const [employes, profils] = await Promise.all([employesAvecAvatar(service, employeIds), profilsAvecAvatar(service, userIds)]);

  const liste = membres
    .map((p) =>
      p.employe_id
        ? { id: p.employe_id, type: "employe", nom: employes?.find((e) => e.id === p.employe_id)?.nom || "Employé", avatar: employes?.find((e) => e.id === p.employe_id)?.avatar || null, estAdmin: !!p.est_admin, moi: p.employe_id === employe.id }
        : { id: p.user_id, type: "admin", nom: profils?.find((x) => x.id === p.user_id)?.full_name || "Administration", avatar: profils?.find((x) => x.id === p.user_id)?.avatar || null, estAdmin: true, moi: false }
    )
    .sort((a, b) => Number(b.estAdmin) - Number(a.estAdmin) || a.nom.localeCompare(b.nom));

  return NextResponse.json({ membres: liste, suisAdmin: liste.some((m) => m.moi && m.estAdmin) });
}

export async function POST(request) {
  const corps = await request.json().catch(() => ({}));
  const ctx = await contexte(request, corps.conversationId);
  if (ctx.reponse) return ctx.reponse;
  const { employe, service, membres } = ctx;
  const conversationId = corps.conversationId;
  const moi = membres.find((p) => p.employe_id === employe.id);
  const suisAdmin = !!moi.est_admin;

  async function nomEmploye(id) {
    const { data } = await service.from("employes").select("nom").eq("id", id).maybeSingle();
    return data?.nom || "Employé";
  }

  if (corps.action === "ajouter") {
    const ids = [...new Set(Array.isArray(corps.employeIds) ? corps.employeIds.map(String) : [])].filter((id) => !membres.some((p) => p.employe_id === id));
    if (ids.length === 0) return NextResponse.json({ error: "Choisis au moins un collègue." }, { status: 400 });
    if (membres.length + ids.length > MAX_MEMBRES) return NextResponse.json({ error: `Un groupe peut avoir ${MAX_MEMBRES} membres au maximum.` }, { status: 400 });

    const { data: nouveaux } = await service.from("employes").select("id, nom").eq("entreprise_id", employe.entreprise_id).in("id", ids);
    if ((nouveaux || []).length !== ids.length) return NextResponse.json({ error: "Collègue introuvable." }, { status: 404 });

    const { bloques } = await chargerRestrictions(service, employe.id);
    if (ids.some((id) => bloques.has(id)) || (await auMoinsUnePaireBloquee(service, [...membres.map((p) => p.employe_id).filter(Boolean), ...ids]))) {
      return NextResponse.json({ error: "Tu ne peux pas ajouter ces personnes à ce groupe." }, { status: 403 });
    }

    const { error } = await service.from("conversation_participants").insert(ids.map((id) => ({ conversation_id: conversationId, employe_id: id })));
    if (error) return NextResponse.json({ error: "L'ajout a échoué." }, { status: 500 });
    const noms = nouveaux.map((n) => n.nom);
    await messageSysteme(service, conversationId, employe.id, { type: "ajoute", acteur: employe.nom, noms }, `${employe.nom} a ajouté ${noms.join(", ")}`);
    return NextResponse.json({ ok: true });
  }

  if (corps.action === "retirer" || corps.action === "admin") {
    if (!suisAdmin) return NextResponse.json({ error: "Seuls les administrateurs du groupe peuvent faire ça." }, { status: 403 });
    const cible = membres.find((p) => p.employe_id && p.employe_id === corps.employeId);
    if (!cible || cible.employe_id === employe.id) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
    const nom = await nomEmploye(cible.employe_id);

    if (corps.action === "retirer") {
      await messageSysteme(service, conversationId, employe.id, { type: "retire", acteur: employe.nom, nom }, `${employe.nom} a retiré ${nom}`);
      const { error } = await service.from("conversation_participants").delete().eq("id", cible.id);
      if (error) return NextResponse.json({ error: "Le retrait a échoué." }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const admin = corps.admin !== false;
    const { error } = await service.from("conversation_participants").update({ est_admin: admin }).eq("id", cible.id);
    if (error) return NextResponse.json({ error: "Le changement a échoué." }, { status: 500 });
    await messageSysteme(
      service,
      conversationId,
      employe.id,
      { type: admin ? "admin" : "adminRetire", acteur: employe.nom, nom },
      admin ? `${employe.nom} a nommé ${nom} administrateur` : `${employe.nom} a retiré le rôle d'administrateur à ${nom}`
    );
    return NextResponse.json({ ok: true });
  }

  if (corps.action === "quitter") {
    const autres = membres.filter((p) => p.id !== moi.id);
    // Dernière personne : le groupe n'a plus de raison d'exister (messages supprimés en cascade).
    if (autres.length === 0) {
      await service.from("conversations").delete().eq("id", conversationId);
      return NextResponse.json({ ok: true, supprime: true });
    }

    await messageSysteme(service, conversationId, employe.id, { type: "quitte", nom: employe.nom }, `${employe.nom} a quitté le groupe`);
    const { error } = await service.from("conversation_participants").delete().eq("id", moi.id);
    if (error) return NextResponse.json({ error: "Impossible de quitter le groupe." }, { status: 500 });

    // Le dernier administrateur part : le membre (employé) le plus ancien reprend le rôle. Rien à faire s'il y a des
    // gens du tableau de bord, ils gèrent le groupe.
    if (moi.est_admin && !autres.some((p) => p.est_admin || p.user_id)) {
      const elu = autres
        .filter((p) => p.employe_id)
        .sort((a, b) => String(a.ajoute_le).localeCompare(String(b.ajoute_le)) || String(a.id).localeCompare(String(b.id)))[0];
      if (elu) {
        await service.from("conversation_participants").update({ est_admin: true }).eq("id", elu.id);
        const nom = await nomEmploye(elu.employe_id);
        await messageSysteme(service, conversationId, employe.id, { type: "adminAuto", nom }, `${nom} est maintenant administrateur`);
      }
    }
    return NextResponse.json({ ok: true, supprime: false });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
