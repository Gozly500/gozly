"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import JourEditor from "@/components/planning/JourEditor";
import { getDebutSemaine, addDays } from "@/lib/semaine";
import { bornesJour, filtrerParDateEffective, decalerJour, dateAujourdhui } from "@/lib/commandes";

function dateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateQuebec(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date(iso));
}

// Boîte "Planification" de la page Commandes (Personnalisation > Commandes en
// ligne > Planification dans les commandes) : les jours de la semaine (avec le
// nombre de réservations de chacun), et sous le jour choisi les catégories de
// tâches où on peut ajouter directement la production à faire - sans quitter
// les commandes. Le jour choisi est partagé avec la liste de commandes.
export default function PlanificationBoite({ entrepriseId, date, onChangerDate, versionCommandes, premierJourDimanche }) {
  const [compteParJour, setCompteParJour] = useState({});

  const debutSemaine = getDebutSemaine(new Date(`${date}T00:00:00`), premierJourDimanche);
  const jours = Array.from({ length: 7 }, (_, i) => addDays(debutSemaine, i));
  const premier = dateStr(jours[0]);
  const aujourdhui = dateAujourdhui();

  useEffect(() => {
    let annule = false;
    const debut = bornesJour(premier).debut;
    const fin = bornesJour(decalerJour(premier, 7)).debut;

    filtrerParDateEffective(
      supabase.from("commandes_en_ligne").select("statut, date_commande, date_ramassage").eq("entreprise_id", entrepriseId).neq("canal", "POS"),
      debut,
      fin
    ).then(({ data }) => {
      if (annule) return;
      const compte = {};
      for (const c of data || []) {
        if (c.statut === "CANCELED") continue;
        const jour = dateQuebec(c.date_ramassage || c.date_commande);
        compte[jour] = (compte[jour] || 0) + 1;
      }
      setCompteParJour(compte);
    });

    return () => {
      annule = true;
    };
  }, [entrepriseId, premier, versionCommandes]);

  return (
    <aside className="cmd-planif">
      <div className="cmd-planif-head">
        <h3>Planification</h3>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="admin-icon-btn" aria-label="Semaine précédente" onClick={() => onChangerDate(decalerJour(date, -7))}>
            ‹
          </button>
          <button className="admin-icon-btn" aria-label="Semaine suivante" onClick={() => onChangerDate(decalerJour(date, 7))}>
            ›
          </button>
        </div>
      </div>

      <div className="cmd-planif-jours">
        {jours.map((d) => {
          const id = dateStr(d);
          const nb = compteParJour[id] || 0;
          return (
            <button
              key={id}
              type="button"
              className={`cmd-planif-jour${id === date ? " actif" : ""}${id === aujourdhui ? " aujourdhui" : ""}`}
              onClick={() => onChangerDate(id)}
            >
              <span className="cmd-planif-jour-nom">{d.toLocaleDateString("fr-CA", { weekday: "short" }).replace(".", "")}</span>
              <span className="cmd-planif-jour-num">{d.getDate()}</span>
              <span className="cmd-planif-jour-nb">{nb > 0 ? `${nb} rés.` : "—"}</span>
            </button>
          );
        })}
      </div>

      <JourEditor entrepriseId={entrepriseId} date={date} integre />
    </aside>
  );
}
