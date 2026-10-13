"use client";

import { useCallback, useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";
import { localeDate } from "@/lib/i18n/moi";
import { IconCloche } from "@/components/icons/Pictogrammes";

// Annonces du propriétaire, mises en évidence en haut de l'app tant qu'elles sont en cours (voir supabase/annonces.sql).
// « OK » masque une annonce sur cet appareil seulement ; elle disparaît pour tout le monde à son expiration.
const CLE_MASQUEES = "gozly_annonces_masquees";
const INTERVALLE_MS = 60000;

function lireMasquees() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(CLE_MASQUEES) || "[]"));
  } catch {
    return new Set();
  }
}

export default function AnnoncesBandeau() {
  const { t, langue } = useLangue();
  const [annonces, setAnnonces] = useState([]);
  const [masquees, setMasquees] = useState(() => new Set());

  const charger = useCallback(async () => {
    try {
      const res = await employeFetch("/api/employe-app/annonces");
      if (!res.ok) return;
      const data = await res.json();
      setAnnonces(data.annonces || []);
    } catch {}
  }, []);

  useEffect(() => {
    setMasquees(lireMasquees());
    charger();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") charger();
    }, INTERVALLE_MS);
    return () => clearInterval(id);
  }, [charger]);

  function masquer(id) {
    const suivant = new Set(masquees);
    suivant.add(id);
    setMasquees(suivant);
    try {
      // On ne garde que les annonces encore en cours : la liste ne grossit pas indéfiniment.
      const encore = new Set(annonces.map((a) => a.id));
      window.localStorage.setItem(CLE_MASQUEES, JSON.stringify([...suivant].filter((x) => encore.has(x))));
    } catch {}
  }

  const visibles = annonces.filter((a) => !masquees.has(a.id));
  if (visibles.length === 0) return null;

  return (
    <div className="moi-annonces">
      {visibles.map((a) => (
        <div className="moi-annonce" key={a.id} role="status">
          <div className="moi-annonce-tete">
            <span className="moi-annonce-titre">
              <IconCloche className="gozly-icon" /> {t("annonce.titre")}
            </span>
            <span className="moi-annonce-fin">{t("annonce.jusqua", { date: new Date(a.fin).toLocaleDateString(localeDate(langue), { day: "numeric", month: "short" }) })}</span>
          </div>
          <p className="moi-annonce-texte">{a.contenu}</p>
          <button type="button" className="admin-icon-btn" onClick={() => masquer(a.id)}>
            {t("annonce.ok")}
          </button>
        </div>
      ))}
    </div>
  );
}
