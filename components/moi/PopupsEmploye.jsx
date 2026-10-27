"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";
import PopupMiseAJour from "@/components/PopupMiseAJour";

// Pop-ups d'ouverture de l'app employé (écrits dans le panneau admin Gozly) : affichés une seule fois à chaque employé.
export default function PopupsEmploye() {
  const { t } = useLangue();
  const [popups, setPopups] = useState([]);

  useEffect(() => {
    let ignore = false;
    employeFetch("/api/employe-app/popups")
      .then(async (res) => {
        if (!res.ok || ignore) return;
        setPopups((await res.json()).popups || []);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  function vu(id) {
    setPopups((l) => l.filter((p) => p.id !== id));
    return employeFetch("/api/employe-app/popups", { method: "POST", body: JSON.stringify({ id }) }).catch(() => {});
  }

  return <PopupMiseAJour popups={popups} onVu={vu} bouton={t("popup.compris")} etiquette={t("popup.nouveaute")} compteur={(n) => t("popup.restants", { n: n - 1 })} />;
}
