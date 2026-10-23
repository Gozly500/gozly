import { NextResponse } from "next/server";
import { LIMITES, db, messageTable, utilisateurDepuisRequete } from "@/lib/ticketsSite";

export const dynamic = "force-dynamic";

// GET            : mes tickets (du plus récent au plus ancien).
// GET ?id=<uuid> : les messages d'un de mes tickets.
export async function GET(request) {
  const user = await utilisateurDepuisRequete(request);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const service = db();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });

  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const { data: ticket } = await service.from("tickets_site").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!ticket) return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });
    const { data: messages, error } = await service.from("tickets_site_messages").select("id, auteur, texte, created_at").eq("ticket_id", id).order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });
    return NextResponse.json({ ticket, messages: messages || [] });
  }

  const { data, error } = await service
    .from("tickets_site")
    .select("id, sujet, statut, dernier_auteur, created_at, maj")
    .eq("user_id", user.id)
    .order("maj", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });
  return NextResponse.json({ tickets: data || [] });
}

// POST { sujet, texte }                : ouvre un ticket.
// POST { action: "repondre", id, texte } : ajoute un message à un de mes tickets ouverts.
// POST { action: "fermer", id }          : ferme un de mes tickets.
export async function POST(request) {
  const user = await utilisateurDepuisRequete(request);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const service = db();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });

  const c = await request.json().catch(() => ({}));
  const texte = String(c.texte || "").trim();

  try {
    if (c.action === "repondre" || c.action === "fermer") {
      const { data: ticket } = await service.from("tickets_site").select("*").eq("id", c.id).eq("user_id", user.id).maybeSingle();
      if (!ticket) return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });

      if (c.action === "fermer") {
        await service.from("tickets_site").update({ statut: "ferme", maj: new Date().toISOString() }).eq("id", ticket.id);
        return NextResponse.json({ ok: true });
      }

      if (ticket.statut !== "ouvert") return NextResponse.json({ error: "Ce ticket est fermé." }, { status: 409 });
      if (!texte) return NextResponse.json({ error: "Écris ton message." }, { status: 400 });
      if (texte.length > LIMITES.texte) return NextResponse.json({ error: `Message trop long (maximum ${LIMITES.texte} caractères).` }, { status: 400 });
      const { error } = await service.from("tickets_site_messages").insert({ ticket_id: ticket.id, auteur: "client", texte });
      if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });
      await service.from("tickets_site").update({ dernier_auteur: "client", maj: new Date().toISOString() }).eq("id", ticket.id);
      return NextResponse.json({ ok: true });
    }

    // Nouveau ticket
    const sujet = String(c.sujet || "").trim();
    if (!sujet) return NextResponse.json({ error: "Écris le sujet de ton ticket." }, { status: 400 });
    if (sujet.length > LIMITES.sujet) return NextResponse.json({ error: `Sujet trop long (maximum ${LIMITES.sujet} caractères).` }, { status: 400 });
    if (!texte) return NextResponse.json({ error: "Décris ton problème ou ta question." }, { status: 400 });
    if (texte.length > LIMITES.texte) return NextResponse.json({ error: `Message trop long (maximum ${LIMITES.texte} caractères).` }, { status: 400 });

    // Limites anti-abus : peu de tickets ouverts en même temps, et un maximum par jour.
    const { data: existants, error: errLim } = await service
      .from("tickets_site")
      .select("id, statut, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (errLim) return NextResponse.json({ error: messageTable(errLim) }, { status: 500 });
    if ((existants || []).filter((t) => t.statut === "ouvert").length >= LIMITES.ticketsOuverts) {
      return NextResponse.json({ error: `Tu as déjà ${LIMITES.ticketsOuverts} tickets ouverts. Ferme-en un ou attends une réponse de l'équipe.` }, { status: 429 });
    }
    const hier = Date.now() - 24 * 3600 * 1000;
    if ((existants || []).filter((t) => new Date(t.created_at).getTime() > hier).length >= LIMITES.ticketsParJour) {
      return NextResponse.json({ error: "Tu as ouvert beaucoup de tickets aujourd'hui. Réessaie demain ou écris-nous à info@gozly.net." }, { status: 429 });
    }

    const { data: ticket, error } = await service.from("tickets_site").insert({ user_id: user.id, sujet }).select("id").single();
    if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });
    const { error: errMsg } = await service.from("tickets_site_messages").insert({ ticket_id: ticket.id, auteur: "client", texte });
    if (errMsg) {
      await service.from("tickets_site").delete().eq("id", ticket.id);
      return NextResponse.json({ error: messageTable(errMsg) }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: ticket.id });
  } catch (e) {
    return NextResponse.json({ error: String(e.message).slice(0, 200) }, { status: 500 });
  }
}
