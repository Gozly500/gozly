import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { periodeDeLigne } from "@/lib/disponibilites";

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_PERIODES = 100;

const dateValide = (s) => typeof s === "string" && RE_DATE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
const aujourdhui = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const erreur = (message, status = 400) => NextResponse.json({ error: message }, { status });

// L'entreprise accepte-t-elle les « pas disponible » ? (Colonne absente tant que le SQL n'est pas exécuté : non.)
async function nonDispoActif(service, entrepriseId) {
  const { data } = await service.from("entreprises").select("horaire_non_dispo_actif").eq("id", entrepriseId).maybeSingle();
  return !!data?.horaire_non_dispo_actif;
}

// Les disponibilités à venir de l'employé connecté. 503 tant que disponibilites.sql n'est pas exécuté (l'app cache alors l'onglet).
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return erreur("Session invalide.", 401);

  const service = getServiceClient();
  const { data, error } = await service
    .from("disponibilites")
    .select("*")
    .eq("employe_id", employe.id)
    .gte("date_fin", aujourdhui())
    .order("date_debut");
  if (error) return erreur("Disponibilités indisponibles.", 503);

  const nonActif = await nonDispoActif(service, employe.entreprise_id);
  const periodes = (data || []).map(periodeDeLigne).filter((p) => nonActif || !p.non);
  return NextResponse.json({ periodes, nonActif });
}

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return erreur("Session invalide.", 401);

  const { debut, fin, de, a, note, non } = await request.json().catch(() => ({}));
  if (!dateValide(debut) || !dateValide(fin) || fin < debut || fin < aujourdhui()) return erreur("Dates invalides.");
  // Les deux heures ou aucune (aucune = toute la journée).
  if ((de || a) && !(RE_HEURE.test(de) && RE_HEURE.test(a) && de < a)) return erreur("Heures invalides.");

  const service = getServiceClient();
  if (non && !(await nonDispoActif(service, employe.entreprise_id))) return erreur("Les non-disponibilités sont désactivées pour ton entreprise.", 403);
  const { count } = await service
    .from("disponibilites")
    .select("id", { count: "exact", head: true })
    .eq("employe_id", employe.id)
    .gte("date_fin", aujourdhui());
  if ((count || 0) >= MAX_PERIODES) return erreur("Trop de périodes enregistrées.");

  const { data, error } = await service
    .from("disponibilites")
    .insert({
      entreprise_id: employe.entreprise_id,
      employe_id: employe.id,
      date_debut: debut,
      date_fin: fin,
      heure_debut: de || null,
      heure_fin: a || null,
      note: typeof note === "string" ? note.trim().slice(0, 200) || null : null,
      ...(non ? { disponible: false } : {}),
    })
    .select("*")
    .single();
  if (error) {
    console.error("Erreur ajout disponibilité:", error);
    return erreur("L'enregistrement a échoué.", 500);
  }

  return NextResponse.json({ periode: periodeDeLigne(data) });
}

export async function DELETE(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return erreur("Session invalide.", 401);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return erreur("Période manquante.");

  const { error } = await getServiceClient().from("disponibilites").delete().eq("id", id).eq("employe_id", employe.id);
  if (error) return erreur("La suppression a échoué.", 500);

  return NextResponse.json({ ok: true });
}
