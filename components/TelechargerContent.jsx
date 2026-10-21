"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import { forfaitPermetTexte } from "@/lib/logiciels";

// Carte de téléchargement de Go-Page : l'état du bouton dépend de la connexion et du forfait.
export default function TelechargerContent() {
  const { t } = useT();
  const [info, setInfo] = useState(null); // { disponible, version, taille }
  const [session, setSession] = useState(undefined); // undefined = en cours de lecture
  const [forfait, setForfait] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null); // null, ou le code d'erreur renvoyé par le serveur

  useEffect(() => {
    fetch("/api/logiciels/texte")
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
  }, []);

  async function telecharger() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await fetch("/api/logiciels/texte?telecharger=1", { headers: { Authorization: `Bearer ${session.access_token}` } });
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

  const mo = info?.taille ? Math.round(info.taille / 1024 / 1024) : null;

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
  } else if (!forfaitPermetTexte(forfait)) {
    action = (
      <>
        <p className="tele-statut">{t("tele.pasForfait")}</p>
        <Link href="/parametres?tab=abonnement" className="submit-btn">
          {t("tele.voirForfaits")}
        </Link>
      </>
    );
  } else {
    action = (
      <button type="button" className="submit-btn" onClick={telecharger} disabled={enCours}>
        {enCours ? t("tele.preparation") : t("tele.btn")}
      </button>
    );
  }

  return (
    <div className="tele-carte">
      <h2>{t("tele.carteTitre")}</h2>
      {info?.disponible && (
        <p className="tele-version">{t("tele.version", { v: info.version, mo: mo ?? "?" })}</p>
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
