import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { bornesJour, decalerJour } from "@/lib/commandes";
import { calculerSemaine } from "@/lib/paie";

// Calculateur de paie de l'employé (supabase/employe_paie.sql) : tout passe par ici, jamais par le navigateur
// directement. Une ligne dans employe_paie = calculateur activé ; pas de ligne = désactivé (rien n'est stocké).

// Sans `semaine` : activé ou non + taux (page Paramètres). Avec `semaine` : aussi les heures de la semaine (horaire).
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const service = getServiceClient();
  const { data: ligne, error } = await service.from("employe_paie").select("taux_horaire").eq("employe_id", employe.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Calculateur de paie indisponible.", indisponible: true }, { status: 500 });
  if (!ligne) return NextResponse.json({ actif: false });

  const taux = ligne.taux_horaire == null ? null : Number(ligne.taux_horaire);
  const { searchParams } = new URL(request.url);
  const semaine = searchParams.get("semaine");
  if (!semaine || !/^\d{4}-\d{2}-\d{2}$/.test(semaine)) return NextResponse.json({ actif: true, taux });

  // --- Heures de la semaine (lundi/dimanche choisi par l'appli, 7 jours à partir de `semaine`) ---
  const finSemaine = decalerJour(semaine, 7);
  const { debut: debutISO } = bornesJour(semaine);
  const { debut: finISO } = bornesJour(finSemaine);
  const [{ data: quarts }, { data: pointages }] = await Promise.all([
    service.from("planning_quarts").select("date, heure_debut, heure_fin").eq("employe_id", employe.id).eq("publie", true).gte("date", semaine).lt("date", finSemaine),
    service.from("pointages").select("entree, sortie").eq("employe_id", employe.id).gte("entree", debutISO).lt("entree", finISO),
  ]);

  return NextResponse.json({ actif: true, taux, ...calculerSemaine({ quarts: quarts || [], pointages: pointages || [] }) });
}

// { actif: true | false } active/désactive (désactiver SUPPRIME la ligne, donc le taux) ; { taux: 18.5 } enregistre le taux.
export async function PATCH(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const service = getServiceClient();

  if (body.actif === false) {
    const { error } = await service.from("employe_paie").delete().eq("employe_id", employe.id);
    if (error) return NextResponse.json({ error: "La désactivation a échoué." }, { status: 500 });
    return NextResponse.json({ actif: false });
  }

  if (body.actif === true) {
    // Réactivation : une nouvelle ligne, sans taux (on ne touche pas à une ligne déjà là).
    const { data: existe } = await service.from("employe_paie").select("employe_id").eq("employe_id", employe.id).maybeSingle();
    if (!existe) {
      const { error } = await service.from("employe_paie").insert({ employe_id: employe.id, taux_horaire: null });
      if (error) return NextResponse.json({ error: "L'activation a échoué." }, { status: 500 });
    }
    return NextResponse.json({ actif: true });
  }

  if (body.taux !== undefined) {
    const taux = Math.round(Number(String(body.taux).replace(",", ".")) * 100) / 100;
    if (!Number.isFinite(taux) || taux <= 0 || taux > 1000) {
      return NextResponse.json({ error: "Entre un taux horaire valide (par exemple 17,50)." }, { status: 400 });
    }
    // On ne crée jamais de ligne ici : seulement si le calculateur est activé.
    const { data, error } = await service.from("employe_paie").update({ taux_horaire: taux }).eq("employe_id", employe.id).select("employe_id");
    if (error) return NextResponse.json({ error: "L'enregistrement a échoué." }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: "Active d'abord le calculateur de paie." }, { status: 409 });
    return NextResponse.json({ actif: true, taux });
  }

  return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
}
