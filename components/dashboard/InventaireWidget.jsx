"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function InventaireWidget({ entrepriseId }) {
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("produits_inventaire")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .then(({ data }) => {
        setProduits(data || []);
        setLoading(false);
      });
  }, [entrepriseId]);

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  const enAlerte = produits.filter((p) => p.quantite <= p.seuil_alerte);

  if (enAlerte.length === 0) {
    return <p className="widget-card-empty">Aucun produit en alerte de stock.</p>;
  }

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Quantité</th>
              <th>Seuil</th>
            </tr>
          </thead>
          <tbody>
            {enAlerte.map((p) => (
              <tr key={p.id}>
                <td>{p.nom}</td>
                <td>{p.quantite}</td>
                <td>{p.seuil_alerte}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link href="/dashboard/inventaire" className="admin-icon-btn" style={{ display: "inline-block", marginTop: "14px" }}>
        Voir l'Inventaire →
      </Link>
    </>
  );
}
