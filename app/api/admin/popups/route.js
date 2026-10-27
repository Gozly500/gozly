import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminServer";
import { db } from "@/lib/annoncesSite";
import { CIBLES_POPUP, LIMITES_POPUP, lienValide } from "@/lib/popupsServer";

export const dynamic = "force-dynamic";

const messageTable = (error) => {
  const m = error?.message || "";
  if (/titre_en|contenu_en|bouton_texte_en/.test(m)) return "La base n'est pas prête pour la version anglaise (SQL popups_app_anglais.sql à exécuter).";
  if (/debut_le|fin_le|bouton_texte|bouton_url/.test(m)) return "La base n'est pas prête pour les dates et le bouton (SQL popups_app_dates_bouton.sql à exécuter).";
  return /popups_app|popups_vus/.test(m) ? "La base n'est pas prête (SQL popups_app.sql à exécuter)." : m || "Erreur.";
};

// GET : tous les pop-ups (actifs et brouillons) avec le nombre de personnes qui les ont déjà vus.
export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = db();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });

  const { data, error } = await service.from("popups_app").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });

  const { data: vus } = await service.from("popups_vus").select("popup_id").limit(50000);
  const compte = {};
  for (const v of vus || []) compte[v.popup_id] = (compte[v.popup_id] || 0) + 1;
  return NextResponse.json({ popups: (data || []).map((p) => ({ ...p, vus: compte[p.id] || 0 })) });
}

// POST { action: "creer" | "modifier" | "activer" | "desactiver" | "reafficher" | "supprimer", id?, titre, contenu, cibles }
//   reafficher : efface « déjà vu » : tout le monde le revoit à sa prochaine ouverture de l'app.
export async function POST(request) {
  const { errorStatus, errorMessage, user } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = db();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });

  const c = await request.json().catch(() => ({}));
  const fin = (error) => (error ? NextResponse.json({ error: messageTable(error) }, { status: 500 }) : NextResponse.json({ ok: true }));

  if (c.action === "supprimer") {
    if (!c.id) return NextResponse.json({ error: "id manquant." }, { status: 400 });
    return fin((await service.from("popups_app").delete().eq("id", c.id)).error);
  }
  if (c.action === "activer" || c.action === "desactiver") {
    if (!c.id) return NextResponse.json({ error: "id manquant." }, { status: 400 });
    const champs = c.action === "activer" ? { actif: true, active_le: new Date().toISOString() } : { actif: false };
    return fin((await service.from("popups_app").update({ ...champs, maj: new Date().toISOString() }).eq("id", c.id)).error);
  }
  if (c.action === "reafficher") {
    if (!c.id) return NextResponse.json({ error: "id manquant." }, { status: 400 });
    return fin((await service.from("popups_vus").delete().eq("popup_id", c.id)).error);
  }
  if (c.action !== "creer" && c.action !== "modifier") return NextResponse.json({ error: "Action inconnue." }, { status: 400 });

  const titre = String(c.titre || "").trim();
  const contenu = String(c.contenu || "").trim();
  const cibles = (Array.isArray(c.cibles) ? c.cibles : []).filter((x) => CIBLES_POPUP.includes(x));
  if (!titre) return NextResponse.json({ error: "Le titre est obligatoire." }, { status: 400 });
  if (titre.length > LIMITES_POPUP.titre) return NextResponse.json({ error: `Titre trop long (maximum ${LIMITES_POPUP.titre} caractères).` }, { status: 400 });
  if (contenu.length > LIMITES_POPUP.contenu) return NextResponse.json({ error: `Texte trop long (maximum ${LIMITES_POPUP.contenu} caractères).` }, { status: 400 });
  if (cibles.length === 0) return NextResponse.json({ error: "Choisis qui doit voir ce pop-up." }, { status: 400 });

  // Période d'affichage (facultative) et bouton de lien (facultatif : texte ET adresse, ou rien).
  const date = (v) => (v ? new Date(v) : null);
  const dateDebut = date(c.debutLe);
  const dateFin = date(c.finLe);
  if ((dateDebut && isNaN(dateDebut)) || (dateFin && isNaN(dateFin))) return NextResponse.json({ error: "Date invalide." }, { status: 400 });
  if (dateDebut && dateFin && dateFin <= dateDebut) return NextResponse.json({ error: "La date de fin doit être après la date de début." }, { status: 400 });
  const boutonTexte = String(c.boutonTexte || "").trim();
  const boutonUrl = String(c.boutonUrl || "").trim();
  if (!!boutonTexte !== !!boutonUrl) return NextResponse.json({ error: "Le bouton a besoin d'un texte ET d'une adresse (ou laisse les deux vides)." }, { status: 400 });
  if (boutonTexte.length > LIMITES_POPUP.boutonTexte) return NextResponse.json({ error: `Texte du bouton trop long (maximum ${LIMITES_POPUP.boutonTexte} caractères).` }, { status: 400 });
  if (boutonUrl && (boutonUrl.length > LIMITES_POPUP.boutonUrl || !lienValide(boutonUrl))) {
    return NextResponse.json({ error: "Adresse du bouton invalide : elle doit commencer par https:// (ou par / pour une page de l'app)." }, { status: 400 });
  }
  // Version anglaise (facultative) : n'est envoyée que si le formulaire en contient une (ou en avait une, pour pouvoir l'effacer).
  const en = c.en && typeof c.en === "object" ? c.en : null;
  const titreEn = String(en?.titre || "").trim();
  const contenuEn = String(en?.contenu || "").trim();
  const boutonTexteEn = String(en?.boutonTexte || "").trim();
  if (titreEn.length > LIMITES_POPUP.titre) return NextResponse.json({ error: `English title too long (maximum ${LIMITES_POPUP.titre} characters).` }, { status: 400 });
  if (contenuEn.length > LIMITES_POPUP.contenu) return NextResponse.json({ error: `English text too long (maximum ${LIMITES_POPUP.contenu} characters).` }, { status: 400 });
  if (boutonTexteEn.length > LIMITES_POPUP.boutonTexte) return NextResponse.json({ error: `English button text too long (maximum ${LIMITES_POPUP.boutonTexte} characters).` }, { status: 400 });
  if ((contenuEn || boutonTexteEn) && !titreEn) return NextResponse.json({ error: "La version anglaise a besoin d'un titre (ou vide le texte et le bouton anglais)." }, { status: 400 });
  const versionAnglaise = en ? { titre_en: titreEn || null, contenu_en: contenuEn || null, bouton_texte_en: boutonTexteEn || null } : {};
  const periodeEtBouton = {
    ...versionAnglaise, debut_le: dateDebut ? dateDebut.toISOString() : null, fin_le: dateFin ? dateFin.toISOString() : null, bouton_texte: boutonTexte || null, bouton_url: boutonUrl || null };

  if (c.action === "modifier") {
    if (!c.id) return NextResponse.json({ error: "id manquant." }, { status: 400 });
    return fin((await service.from("popups_app").update({ titre, contenu, cibles, ...periodeEtBouton, maj: new Date().toISOString() }).eq("id", c.id)).error);
  }
  const actif = !!c.activer;
  return fin((await service.from("popups_app").insert({ titre, contenu, cibles, ...periodeEtBouton, actif, active_le: actif ? new Date().toISOString() : null, cree_par: user?.email || null })).error);
}
