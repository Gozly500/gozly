"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  formatMontant,
  dateAujourdhui,
  bornesJour,
  heureCommande,
  etatCommande,
  filtrerParDateEffective,
  dateEffective,
  libelleRamassage,
} from "@/lib/commandes";
import { IconFlecheDroite } from "@/components/icons/Pictogrammes";

export default function CommandesWidget({ entrepriseId }) {
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { debut, fin } = bornesJour(dateAujourdhui());
    filtrerParDateEffective(
      supabase
        .from("commandes_en_ligne")
        .select("id, numero, client_nom, total, statut, statut_preparation, etape, date_commande, date_ramassage, date_ramassage_fin")
        .eq("entreprise_id", entrepriseId)
        .neq("canal", "POS"),
      debut,
      fin
    ).then(({ data }) => {
      setCommandes((data || []).sort((a, b) => new Date(dateEffective(a)) - new Date(dateEffective(b))));
      setLoading(false);
    });
  }, [entrepriseId]);

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  const valides = commandes.filter((c) => c.statut !== "CANCELED");
  const aPreparer = valides.filter((c) => etatCommande(c).id === "en_attente").length;
  const total = valides.reduce((sum, c) => sum + Number(c.total), 0);

  if (commandes.length === 0) {
    return (
      <>
        <p className="widget-card-empty">Aucune commande en ligne aujourd&apos;hui.</p>
        <Link href="/dashboard/commandes" className="admin-icon-btn" style={{ display: "inline-block", marginTop: "10px" }}>
          Voir les commandes <IconFlecheDroite className="gozly-icon-inline" />
        </Link>
      </>
    );
  }

  return (
    <>
      <p style={{ fontSize: "28px", fontWeight: 700 }}>{formatMontant(total)}</p>
      <p className="section-hint" style={{ marginTop: "-4px" }}>
        {valides.length} commande{valides.length > 1 ? "s" : ""} à ramasser aujourd&apos;hui
        {aPreparer > 0 && ` · ${aPreparer} en attente`}
      </p>

      {valides.slice(0, 3).map((c) => (
        <div key={c.id} style={{ fontSize: "13.5px", marginTop: "6px", display: "flex", justifyContent: "space-between", gap: "10px" }}>
          <span>
            #{c.numero || "—"} · {libelleRamassage(c) || heureCommande(c.date_commande)}
            {c.client_nom ? ` · ${c.client_nom}` : ""}
          </span>
          <span style={{ fontWeight: 600 }}>{formatMontant(c.total)}</span>
        </div>
      ))}

      <Link href="/dashboard/commandes" className="admin-icon-btn" style={{ display: "inline-block", marginTop: "12px" }}>
        Voir les commandes <IconFlecheDroite className="gozly-icon-inline" />
      </Link>
    </>
  );
}
