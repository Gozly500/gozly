"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Même contenu que /s-abonner. Le forfait n'est JAMAIS activé ici : le bouton
// ouvre Stripe Checkout, et c'est le webhook qui active le forfait après paiement.
const FORFAITS = [
  { id: "opale", nom: "Opale", prix: "25$", icone: "pi-1", points: ["3 modules", "Assistance standard", "Mises à jour essentielles"] },
  { id: "onyx", nom: "Onyx", prix: "40$", icone: "pi-2", featured: true, points: ["5 modules", "Support prioritaire", "Mises à jour avancées"] },
  {
    id: "crystal",
    nom: "Crystal",
    prix: "50$",
    icone: "pi-3",
    points: ["Modules illimités", "Module personnalisé sur demande", "Assistance prioritaire", "Mises à jour avancées"],
  },
];

export default function ChoisirForfaitContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [choix, setChoix] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (ignore) return;
      if (!session) {
        router.replace("/login");
        return;
      }

      // Déjà un forfait actif (ex: page rouverte plus tard) : rien à choisir ici.
      const { data: profil } = await supabase.from("profils").select("entreprise_id").eq("id", session.user.id).maybeSingle();
      if (profil?.entreprise_id) {
        const { data: entreprise } = await supabase
          .from("entreprises")
          .select("forfait")
          .eq("id", profil.entreprise_id)
          .maybeSingle();
        if (ignore) return;
        if (entreprise?.forfait) {
          router.replace("/dashboard");
          return;
        }
      }

      setChecking(false);
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  async function choisir(forfaitId) {
    setChoix(forfaitId);
    setError("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ forfait: forfaitId }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error || "Le paiement n'est pas disponible pour le moment. Tu peux réessayer depuis Paramètres > Abonnement.");
        setChoix(null);
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      setError("Le paiement n'est pas disponible pour le moment. Tu peux réessayer depuis Paramètres > Abonnement.");
      setChoix(null);
    }
  }

  if (checking) {
    return <p style={{ color: "var(--text-dim)", textAlign: "center" }}>Chargement...</p>;
  }

  return (
    <>
      <div className="pricing">
        {FORFAITS.map((f) => (
          <div key={f.id} className={`price-card${f.featured ? " featured" : ""}`}>
            <div className="price-head">
              <div className={`price-icon ${f.icone}`}></div>
              <h3>{f.nom}</h3>
            </div>
            <div className="price">
              {f.prix}
              <span>/mois</span>
            </div>
            <ul>
              {f.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <button
              type="button"
              className="price-btn"
              style={{ border: "none", color: "inherit", fontFamily: "inherit", cursor: "pointer", width: "100%" }}
              disabled={choix !== null}
              onClick={() => choisir(f.id)}
            >
              {choix === f.id ? "Redirection vers le paiement..." : "Choisir ce forfait"}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="settings-msg err" style={{ textAlign: "center", marginTop: "18px" }}>
          {error}
        </p>
      )}

      <p style={{ textAlign: "center", marginTop: "26px", fontSize: "13px" }}>
        <Link href="/dashboard" style={{ color: "var(--text-dim)", textDecoration: "underline" }}>
          Ignorer pour l'instant
        </Link>
      </p>
    </>
  );
}
