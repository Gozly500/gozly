"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import { labelForfait } from "@/lib/modules";
import { useForfaits } from "@/lib/useForfaits";

// Bouton « Choisir ce forfait » des cartes publiques (accueil et /s-abonner).
//  - pas connecté : va à l'inscription avec ce forfait présélectionné ;
//  - connecté sans forfait : va dans Paramètres, où le paiement démarre ;
//  - connecté avec un forfait : une fenêtre demande s'il veut passer au nouveau forfait (ou lui dit qu'il l'a déjà).
export default function BoutonForfait({ forfait, nom, className, children }) {
  const { t } = useT();
  useForfaits();
  const router = useRouter();
  const [session, setSession] = useState(null); // null = pas connecté (ou pas encore lu)
  const [forfaitActuel, setForfaitActuel] = useState(null);
  const [fenetre, setFenetre] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let ignore = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (ignore || !data?.session) return;
      setSession(data.session);
      const { data: profil } = await supabase.from("profils").select("forfait").eq("id", data.session.user.id).maybeSingle();
      if (!ignore) setForfaitActuel(profil?.forfait || null);
    });
    return () => {
      ignore = true;
    };
  }, []);

  function cliquer(e) {
    if (!session) return; // lien normal vers l'inscription
    e.preventDefault();
    if (!forfaitActuel) {
      router.push(`/parametres?acheter=${forfait}`);
      return;
    }
    setErreur("");
    setFenetre(true);
  }

  // Même chemin que Paramètres > Abonnement : le paiement, ou le portail Stripe quand un abonnement existe déjà.
  async function passer() {
    setOccupe(true);
    setErreur("");
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ forfait, periode: "mensuel" }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setErreur(data.error || t("Le paiement n'est pas disponible pour le moment. Tu peux réessayer depuis Paramètres > Abonnement."));
        setOccupe(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setErreur(t("Le paiement n'est pas disponible pour le moment. Tu peux réessayer depuis Paramètres > Abonnement."));
      setOccupe(false);
    }
  }

  const dejaCeForfait = forfaitActuel === forfait;
  const actuel = forfaitActuel ? labelForfait(forfaitActuel) : "";

  return (
    <>
      <Link href={`/inscription?forfait=${forfait}`} className={className} onClick={cliquer}>
        {children}
      </Link>

      {fenetre && (
        <div className="modal-overlay" onClick={() => !occupe && setFenetre(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{dejaCeForfait ? t("Tu as déjà ce forfait") : t("Changer de forfait?")}</h3>
            </div>
            <p className="panel-hint" style={{ marginBottom: "18px" }}>
              {dejaCeForfait
                ? t("Tu as déjà le forfait {actuel}.", { actuel })
                : t("Tu as déjà le forfait {actuel}. Veux-tu passer à {nouveau}?", { actuel, nouveau: nom })}
            </p>
            {erreur && <p className="settings-msg err">{erreur}</p>}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {!dejaCeForfait && (
                <button type="button" className="submit-btn" disabled={occupe} onClick={passer}>
                  {occupe ? t("Redirection vers le paiement...") : t("Passer à {nouveau}", { nouveau: nom })}
                </button>
              )}
              <button type="button" className="admin-icon-btn" disabled={occupe} onClick={() => setFenetre(false)}>
                {dejaCeForfait ? t("Fermer") : t("Annuler")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
