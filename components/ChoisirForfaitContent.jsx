"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import PeriodeFacturation from "@/components/PeriodeFacturation";
import { PRIX_FORFAITS } from "@/lib/forfaitsPrix";
import BlocsEmployes from "@/components/BlocsEmployes";
import { limiteEmployes } from "@/lib/modules";
import { useForfaits } from "@/lib/useForfaits";

// Même contenu que /s-abonner. Le forfait n'est JAMAIS activé ici : le bouton
// ouvre Stripe Checkout, et c'est le webhook qui active le forfait après paiement.
const FORFAITS = [
  {
    id: "opale",
    nom: "Opale",
    icone: "pi-1",
    points: ["3 modules", "1 entreprise", "Jusqu'à 15 employés par entreprise", "Assistance standard", "Mises à jour essentielles"],
  },
  {
    id: "onyx",
    nom: "Onyx",
    icone: "pi-2",
    featured: true,
    points: ["5 modules", "3 entreprises", "Jusqu'à 30 employés par entreprise", "Support prioritaire", "Mises à jour avancées"],
  },
  {
    id: "crystal",
    nom: "Crystal",
    icone: "pi-3",
    points: [
      "Modules illimités",
      "5 entreprises",
      "Employés illimités",
      "Module personnalisé sur demande",
      "Assistance prioritaire",
      "Mises à jour avancées",
    ],
  },
];

export default function ChoisirForfaitContent() {
  const { t } = useT();
  useForfaits(); // limites d'employés des forfaits (un forfait illimité n'a pas besoin d'employés en extra)
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [choix, setChoix] = useState(null);
  const [error, setError] = useState("");
  const [periode, setPeriode] = useState("mensuel");
  const [blocs, setBlocs] = useState({}); // blocs de 5 employés choisis, par forfait

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (ignore) return;
      if (!session) {
        router.replace("/login");
        return;
      }

      // Déjà un forfait actif (ex: page rouverte plus tard) : rien à choisir ici.
      // Le forfait appartient au COMPTE (voir supabase/forfait_par_compte.sql).
      const { data: profil } = await supabase.from("profils").select("forfait").eq("id", session.user.id).maybeSingle();
      if (ignore) return;
      if (profil?.forfait) {
        router.replace("/dashboard");
        return;
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
        body: JSON.stringify({ forfait: forfaitId, periode, blocs: Number.isFinite(limiteEmployes(forfaitId)) ? blocs[forfaitId] || 0 : 0 }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error || t("Le paiement n'est pas disponible pour le moment. Tu peux réessayer depuis Paramètres > Abonnement."));
        setChoix(null);
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      setError(t("Le paiement n'est pas disponible pour le moment. Tu peux réessayer depuis Paramètres > Abonnement."));
      setChoix(null);
    }
  }

  if (checking) {
    return <p style={{ color: "var(--text-dim)", textAlign: "center" }}>{t("Chargement...")}</p>;
  }

  return (
    <>
      <PeriodeFacturation value={periode} onChange={setPeriode} disabled={choix !== null} />

      <div className="pricing">
        {FORFAITS.map((f) => (
          <div key={f.id} className={`price-card${f.featured ? " featured" : ""}`}>
            <div className="price-head">
              <div className={`price-icon ${f.icone}`}></div>
              <h3>{f.nom}</h3>
            </div>
            <div className="price">
              {t(`${PRIX_FORFAITS[f.id][periode]}$`)}
              <span>{periode === "annuel" ? t("/an") : t("/mois")}</span>
            </div>
            <ul>
              {f.points.map((p) => (
                <li key={p}>{t(p)}</li>
              ))}
            </ul>
            {Number.isFinite(limiteEmployes(f.id)) && (
              <BlocsEmployes compact valeur={blocs[f.id] || 0} onChange={(n) => setBlocs((b) => ({ ...b, [f.id]: n }))} periode={periode} disabled={choix !== null} />
            )}
            <button
              type="button"
              className="price-btn"
              style={{ border: "none", color: "inherit", fontFamily: "inherit", cursor: "pointer", width: "100%" }}
              disabled={choix !== null}
              onClick={() => choisir(f.id)}
            >
              {choix === f.id ? t("Redirection vers le paiement...") : t("Choisir ce forfait")}
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
          {t("Ignorer pour l'instant")}
        </Link>
      </p>
    </>
  );
}
