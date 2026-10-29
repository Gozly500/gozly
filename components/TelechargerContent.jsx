"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import { LOGICIELS, forfaitPermetLogiciel } from "@/lib/logiciels";

// Carte de téléchargement d'un logiciel (logiciel = texte, calky, kiosque...) : l'état du bouton dépend de la connexion et du forfait.
// Le bouton mène à la page d'installation (/telecharger/<slug>) : les étapes s'y affichent et le téléchargement y démarre.
// compact : sans le cadre « Télécharger » (version + bouton seulement), pour les cartes du catalogue /logiciels.
export default function TelechargerContent({ logiciel, compact = false }) {
  const { t, lang } = useT();
  const [info, setInfo] = useState(null); // { disponible, version, taille }
  const [session, setSession] = useState(undefined); // undefined = en cours de lecture
  const [forfait, setForfait] = useState(null);

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

  // Taille en Mo : une décimale sous 10 Mo (l'app Android pèse ~0,1 Mo), sinon arrondie
  const brut = info?.taille ? info.taille / 1024 / 1024 : null;
  const mo = brut === null ? null : brut < 10 ? brut.toFixed(1).replace(".", lang === "fr" ? "," : ".") : Math.round(brut);
  const { nom, slug, plateforme } = LOGICIELS[logiciel];
  const android = plateforme === "android";
  const pourTous = LOGICIELS[logiciel].forfaits.includes("opale"); // inclus avec tous les forfaits
  const pageInstallation = `/telecharger/${slug}`;

  let action;
  if (!info || session === undefined) {
    action = <span className="tele-statut">…</span>;
  } else if (!info.disponible) {
    action = <span className="tele-statut">{t("tele.bientot")}</span>;
  } else if (!session) {
    action = (
      <Link href={`/login?retour=${encodeURIComponent(pageInstallation)}`} className="submit-btn">
        {t("tele.connexion")}
      </Link>
    );
  } else if (!forfaitPermetLogiciel(forfait, logiciel)) {
    action = (
      <>
        <p className="tele-statut">{t(pourTous ? "tele.pasForfaitTous" : "tele.pasForfait", { nom })}</p>
        <Link href="/parametres?tab=abonnement" className="submit-btn">
          {t("tele.voirForfaits")}
        </Link>
      </>
    );
  } else {
    action = (
      <Link href={pageInstallation} className="submit-btn">
        {t(android ? "tele.btn.android" : "tele.btn")}
      </Link>
    );
  }

  const version = info?.disponible && <p className="tele-version">{t(android ? "tele.version.android" : "tele.version", { v: info.version, mo: mo ?? "?" })}</p>;

  if (compact) {
    return (
      <div className="tele-compact">
        {version}
        <div className="tele-action">{action}</div>
      </div>
    );
  }

  return (
    <div className="tele-carte">
      <h2>{t("tele.carteTitre")}</h2>
      {version}
      <div className="tele-action">{action}</div>
    </div>
  );
}
