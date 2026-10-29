"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import { LOGICIELS, forfaitPermetLogiciel } from "@/lib/logiciels";

// Carte de téléchargement d'un logiciel (logiciel = texte, calky, kiosque...) : l'état du bouton dépend de la connexion et du forfait.
// compact : sans le cadre « Télécharger » (version + bouton seulement), pour les cartes du catalogue /logiciels.
export default function TelechargerContent({ logiciel, compact = false }) {
  const { t, lang } = useT();
  const [info, setInfo] = useState(null); // { disponible, version, taille }
  const [session, setSession] = useState(undefined); // undefined = en cours de lecture
  const [forfait, setForfait] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null); // null, ou le code d'erreur renvoyé par le serveur

  useEffect(() => {
    fetch(`/api/logiciels/${logiciel}`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ disponible: false }));

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session || null);
      if (data.session) {
        const { data: profil } = await supabase.from("profils").select("forfait").eq("id", data.session.user.id).maybeSingle();
        setForfait(profil?.forfait || null);
      }
    });
  }, [logiciel]);

  async function telecharger() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await fetch(`/api/logiciels/${logiciel}?telecharger=1`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const json = await r.json().catch(() => ({}));
      if (!r.ok || !json.url) {
        setErreur(json.code || `http_${r.status}`);
      } else {
        window.location.href = json.url;
      }
    } catch {
      setErreur("reseau");
    }
    setEnCours(false);
  }

  // Taille en Mo : une décimale sous 10 Mo (l'app Android pèse ~0,1 Mo), sinon arrondie
  const brut = info?.taille ? info.taille / 1024 / 1024 : null;
  const mo = brut === null ? null : brut < 10 ? brut.toFixed(1).replace(".", lang === "fr" ? "," : ".") : Math.round(brut);
  const android = LOGICIELS[logiciel].plateforme === "android";
  const pourTous = LOGICIELS[logiciel].forfaits.includes("opale"); // inclus avec tous les forfaits

  let action;
  if (!info || session === undefined) {
    action = <span className="tele-statut">…</span>;
  } else if (!info.disponible) {
    action = <span className="tele-statut">{t("tele.bientot")}</span>;
  } else if (!session) {
    action = (
      <Link href="/login" className="submit-btn">
        {t("tele.connexion")}
      </Link>
    );
  } else if (!forfaitPermetLogiciel(forfait, logiciel)) {
    action = (
      <>
        <p className="tele-statut">{t(pourTous ? "tele.pasForfaitTous" : "tele.pasForfait", { nom: LOGICIELS[logiciel].nom })}</p>
        <Link href="/parametres?tab=abonnement" className="submit-btn">
          {t("tele.voirForfaits")}
        </Link>
      </>
    );
  } else {
    action = (
      <button type="button" className="submit-btn" onClick={telecharger} disabled={enCours}>
        {enCours ? t("tele.preparation") : t(android ? "tele.btn.android" : "tele.btn")}
      </button>
    );
  }

  if (compact) {
    return (
      <div className="tele-compact">
        {info?.disponible && <p className="tele-version">{t(android ? "tele.version.android" : "tele.version", { v: info.version, mo: mo ?? "?" })}</p>}
        <div className="tele-action">{action}</div>
        {erreur && (
          <p className="tele-erreur">
            {t("tele.erreur")} <span style={{ opacity: 0.7 }}>({erreur})</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="tele-carte">
      <h2>{t("tele.carteTitre")}</h2>
      {info?.disponible && (
        <p className="tele-version">{t(android ? "tele.version.android" : "tele.version", { v: info.version, mo: mo ?? "?" })}</p>
      )}
      <div className="tele-action">{action}</div>
      {erreur && (
        <p className="tele-erreur">
          {t("tele.erreur")} <span style={{ opacity: 0.7 }}>({erreur})</span>
        </p>
      )}
    </div>
  );
}
