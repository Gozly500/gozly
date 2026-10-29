"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import { LOGICIELS, forfaitPermetLogiciel } from "@/lib/logiciels";

// État du téléchargement sur la page d'installation (/telecharger/<slug>) : vérifie la connexion et le forfait, puis démarre
// le téléchargement tout seul, une seule fois. Les étapes d'installation sont affichées à côté par la page.
export default function InstallationLogiciel({ logiciel }) {
  const { t } = useT();
  const { nom, slug } = LOGICIELS[logiciel];
  const [etat, setEtat] = useState("chargement"); // chargement | connexion | forfait | indisponible | demarre | pret | erreur
  const [code, setCode] = useState(null);
  const session = useRef(null);
  const lance = useRef(false);

  async function lancer() {
    if (!session.current) return;
    setEtat("demarre");
    setCode(null);
    try {
      const r = await fetch(`/api/logiciels/${logiciel}?telecharger=1`, { headers: { Authorization: `Bearer ${session.current.access_token}` } });
      const json = await r.json().catch(() => ({}));
      if (!r.ok || !json.url) {
        setCode(json.code || `http_${r.status}`);
        setEtat("erreur");
        return;
      }
      window.location.href = json.url; // le fichier se télécharge sans quitter la page
      setEtat("pret");
    } catch {
      setCode("reseau");
      setEtat("erreur");
    }
  }

  useEffect(() => {
    let annule = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (annule) return;
      if (!data.session) {
        setEtat("connexion");
        return;
      }
      session.current = data.session;

      const { data: profil } = await supabase.from("profils").select("forfait").eq("id", data.session.user.id).maybeSingle();
      if (annule) return;
      if (!forfaitPermetLogiciel(profil?.forfait, logiciel)) {
        setEtat("forfait");
        return;
      }

      const info = await fetch(`/api/logiciels/${logiciel}`).then((r) => r.json()).catch(() => ({ disponible: false }));
      if (annule) return;
      if (!info.disponible) {
        setEtat("indisponible");
        return;
      }
      if (!lance.current) {
        lance.current = true;
        lancer();
      }
    })();
    return () => {
      annule = true;
    };
  }, [logiciel]);

  return (
    <div className="inst-carte">
      <div className="inst-statut" role="status">
        {(etat === "chargement" || etat === "demarre") && (
          <>
            <div className="inst-rond" />
            <p>{t(etat === "chargement" ? "inst.prep" : "inst.demarre")}</p>
          </>
        )}

        {etat === "pret" && (
          <>
            <div className="inst-ok">✓</div>
            <p>{t("inst.ok")}</p>
            <button type="button" className="inst-lien" onClick={lancer}>
              {t("inst.relancer")}
            </button>
          </>
        )}

        {etat === "connexion" && (
          <>
            <p>{t("inst.connexion", { nom })}</p>
            <Link href={`/login?retour=${encodeURIComponent(`/telecharger/${slug}`)}`} className="submit-btn">
              {t("tele.connexion")}
            </Link>
          </>
        )}

        {etat === "forfait" && (
          <>
            <p>{t("tele.pasForfait", { nom })}</p>
            <Link href="/parametres?tab=abonnement" className="submit-btn">
              {t("tele.voirForfaits")}
            </Link>
          </>
        )}

        {etat === "indisponible" && <p>{t("inst.indispo")}</p>}

        {etat === "erreur" && (
          <>
            <p>
              {t("tele.erreur")} <span style={{ opacity: 0.7 }}>({code})</span>
            </p>
            <button type="button" className="submit-btn" onClick={lancer}>
              {t("inst.reessayer")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
