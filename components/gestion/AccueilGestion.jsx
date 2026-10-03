"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useGestion } from "@/components/gestion/GestionShell";
import { dateAujourdhui, bornesJour, filtrerParDateEffective, etatCommande, formatMontant } from "@/lib/commandes";

// Accueil de l'app gestionnaire : un coup d'œil sur ce qui demande l'attention maintenant.
export default function AccueilGestion() {
  const { entrepriseId, modulesActifs, onglets, a } = useGestion();
  const [enPoste, setEnPoste] = useState(null); // noms des employés actuellement en poste
  const [commandes, setCommandes] = useState(null); // commandes du jour
  const [demandes, setDemandes] = useState(null); // nombre de demandes à traiter

  const horaire = modulesActifs.includes("horaire");
  const commandesActif = modulesActifs.includes("commandes");

  useEffect(() => {
    if (!horaire) return;
    (async () => {
      const [{ data: ouverts }, { data: employes }] = await Promise.all([
        supabase.from("pointages").select("employe_id").eq("entreprise_id", entrepriseId).is("sortie", null),
        supabase.from("employes").select("id, nom").eq("entreprise_id", entrepriseId),
      ]);
      const noms = (ouverts || []).map((p) => employes?.find((e) => e.id === p.employe_id)?.nom).filter(Boolean);
      setEnPoste([...new Set(noms)]);

      if (a("approuver_demandes")) {
        const [{ data: conges }, { data: echanges }] = await Promise.all([
          supabase.from("demandes_conge").select("id").eq("entreprise_id", entrepriseId).eq("statut", "en_attente"),
          supabase
            .from("demandes_echange")
            .select("id")
            .eq("entreprise_id", entrepriseId)
            .eq("statut_employe", "accepte")
            .eq("statut_admin", "en_attente"),
        ]);
        setDemandes((conges || []).length + (echanges || []).length);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrepriseId, horaire]);

  useEffect(() => {
    if (!commandesActif) return;
    const { debut, fin } = bornesJour(dateAujourdhui());
    filtrerParDateEffective(
      supabase
        .from("commandes_en_ligne")
        .select("id, total, statut, statut_preparation, etape, date_commande, date_ramassage, date_ramassage_fin")
        .eq("entreprise_id", entrepriseId)
        .neq("canal", "POS"),
      debut,
      fin
    ).then(({ data }) => setCommandes((data || []).filter((c) => c.statut !== "CANCELED")));
  }, [entrepriseId, commandesActif]);

  const aTraiter = commandes ? commandes.filter((c) => etatCommande(c).id === "en_attente").length : 0;
  const totalCommandes = commandes ? commandes.reduce((s, c) => s + Number(c.total), 0) : 0;

  return (
    <div>
      <h2 style={{ marginBottom: "14px" }}>Aujourd&apos;hui</h2>

      <div className="gestion-accueil-cartes">
        {horaire && (
          <Link href="/gestion/horaire" className="planning-day gestion-accueil-carte">
            <div className="gestion-accueil-titre">En poste maintenant</div>
            {enPoste === null ? (
              <div className="gestion-accueil-valeur">…</div>
            ) : (
              <>
                <div className="gestion-accueil-valeur">{enPoste.length}</div>
                <div className="gestion-accueil-detail">{enPoste.length > 0 ? enPoste.join(", ") : "Personne pour l'instant"}</div>
              </>
            )}
          </Link>
        )}

        {commandesActif && (
          <Link href="/gestion/commandes" className="planning-day gestion-accueil-carte">
            <div className="gestion-accueil-titre">Commandes du jour</div>
            {commandes === null ? (
              <div className="gestion-accueil-valeur">…</div>
            ) : (
              <>
                <div className="gestion-accueil-valeur">{commandes.length}</div>
                <div className="gestion-accueil-detail">
                  {commandes.length === 0
                    ? "Aucune commande aujourd'hui"
                    : `${aTraiter > 0 ? `${aTraiter} en attente · ` : ""}${formatMontant(totalCommandes)}`}
                </div>
              </>
            )}
          </Link>
        )}

        {horaire && demandes !== null && (
          <Link href="/gestion/demandes" className="planning-day gestion-accueil-carte">
            <div className="gestion-accueil-titre">Demandes à traiter</div>
            <div className="gestion-accueil-valeur">{demandes}</div>
            <div className="gestion-accueil-detail">{demandes > 0 ? "Congés et échanges de quart" : "Rien en attente"}</div>
          </Link>
        )}
      </div>

      {onglets.length <= 1 && <p className="chat-empty">Aucun module disponible pour l&apos;instant.</p>}
    </div>
  );
}
