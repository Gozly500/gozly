import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminServer";
import {
  TAILLE_MAX_IMAGE,
  TYPES_IMAGE,
  db,
  envoyerImage,
  messageDiscord,
  messageTable,
  publierSurDiscord,
  salonAnnoncesParDefaut,
  supprimerImage,
  supprimerSurDiscord,
} from "@/lib/annoncesSite";
import { discord } from "@/lib/discordTickets";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LIMITES = { titre: 150, contenu: 6000 };

// GET : toutes les annonces (publiées et brouillons) + salon Discord proposé par défaut.
export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = db();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  const { data, error } = await service.from("annonces_site").select("*").order("publie_le", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });
  const discordConfigure = !!((process.env.DISCORD_GUILD_ID || "").trim() && process.env.DISCORD_BOT_TOKEN);
  return NextResponse.json({ annonces: data || [], discordConfigure, canalParDefaut: await salonAnnoncesParDefaut() });
}

// POST (JSON ou formulaire avec une image jointe : { donnees: "<json>", image: <fichier> })
//   donnees : { action: "creer" | "modifier" | "supprimer" | "discord", id?, titre, contenu, publie, retirerImage,
//               discord: { envoyer: boolean, canalId } }
export async function POST(request) {
  const { errorStatus, errorMessage, user } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = db();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });

  let c = {};
  let fichier = null;
  if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
    const f = await request.formData().catch(() => null);
    if (!f) return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
    try {
      c = JSON.parse(String(f.get("donnees") || "{}"));
    } catch {
      return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
    }
    const img = f.get("image");
    if (img && typeof img === "object" && img.size > 0) {
      if (!TYPES_IMAGE[img.type]) return NextResponse.json({ error: "Format d'image non accepté (PNG, JPG, GIF ou WebP)." }, { status: 400 });
      if (img.size > TAILLE_MAX_IMAGE) return NextResponse.json({ error: "Image trop lourde (maximum 4 Mo)." }, { status: 400 });
      fichier = img;
    }
  } else {
    c = await request.json().catch(() => ({}));
  }

  try {
    const charger = async (id) => (await service.from("annonces_site").select("*").eq("id", id).maybeSingle()).data;

    // --- Supprimer ---
    if (c.action === "supprimer") {
      const a = await charger(c.id);
      if (!a) return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
      const { error } = await service.from("annonces_site").delete().eq("id", a.id);
      if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });
      await supprimerImage(service, a.image_chemin);
      await supprimerSurDiscord(a);
      return NextResponse.json({ ok: true });
    }

    // --- Envoyer / mettre à jour dans Discord ---
    if (c.action === "discord") {
      const a = await charger(c.id);
      if (!a) return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
      if (!a.publie) return NextResponse.json({ error: "Publie l'annonce avant de l'envoyer dans Discord (le lien mènerait à une page vide)." }, { status: 409 });
      const r = await publierSurDiscord(service, a, c.canalId);
      return NextResponse.json({ ok: true, ...r });
    }

    // --- Créer / modifier ---
    const titre = String(c.titre || "").trim();
    const contenu = String(c.contenu || "").trim();
    if (!titre) return NextResponse.json({ error: "Écris le titre de l'annonce." }, { status: 400 });
    if (titre.length > LIMITES.titre) return NextResponse.json({ error: `Titre trop long (maximum ${LIMITES.titre} caractères).` }, { status: 400 });
    if (contenu.length > LIMITES.contenu) return NextResponse.json({ error: `Texte trop long (maximum ${LIMITES.contenu} caractères).` }, { status: 400 });
    const publie = c.publie !== false;

    let annonce;
    if (c.action === "modifier") {
      const a = await charger(c.id);
      if (!a) return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
      const champs = { titre, contenu, publie, maj: new Date().toISOString() };
      if (publie && !a.publie) champs.publie_le = new Date().toISOString(); // première publication d'un brouillon
      if (fichier || c.retirerImage) {
        await supprimerImage(service, a.image_chemin);
        Object.assign(champs, { image_url: null, image_chemin: null });
        if (fichier) Object.assign(champs, await envoyerImage(service, fichier));
      }
      const { data, error } = await service.from("annonces_site").update(champs).eq("id", a.id).select().single();
      if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });
      annonce = data;
      // Si elle est déjà dans Discord, le message est mis à jour aussi.
      if (annonce.discord_canal_id && annonce.discord_message_id && annonce.publie) {
        await discord("PATCH", `/channels/${annonce.discord_canal_id}/messages/${annonce.discord_message_id}`, messageDiscord(annonce)).catch(() => {});
      }
    } else {
      const champs = { titre, contenu, publie, cree_par: user?.email || null };
      if (fichier) Object.assign(champs, await envoyerImage(service, fichier));
      const { data, error } = await service.from("annonces_site").insert(champs).select().single();
      if (error) {
        await supprimerImage(service, champs.image_chemin);
        return NextResponse.json({ error: messageTable(error) }, { status: 500 });
      }
      annonce = data;
    }

    // Option « Publier aussi dans Discord » : une erreur Discord n'annule pas l'annonce.
    let discordInfo = null;
    if (c.discord?.envoyer) {
      if (!annonce.publie) discordInfo = { erreur: "Brouillon : non envoyé dans Discord." };
      else {
        try {
          discordInfo = await publierSurDiscord(service, annonce, c.discord.canalId);
        } catch (e) {
          discordInfo = { erreur: String(e.message).replace(process.env.DISCORD_BOT_TOKEN || "\0", "***").slice(0, 200) };
        }
      }
    }
    return NextResponse.json({ ok: true, id: annonce.id, discord: discordInfo });
  } catch (e) {
    return NextResponse.json({ error: String(e.message).replace(process.env.DISCORD_BOT_TOKEN || "\0", "***").slice(0, 300) }, { status: 502 });
  }
}
