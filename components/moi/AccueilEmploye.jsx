"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { employeFetch } from "@/lib/employeAuth";
import {
  IconHoraire,
  IconDemande,
  IconDiscussion,
  IconTaches,
  IconTemperature,
} from "@/components/icons/GozlyIcons";
import PointageMobileBloc from "@/components/moi/PointageMobileBloc";

// Les 3 pages de base, en petites cases sur une seule ligne.
const PRINCIPAUX = [
  { id: "horaire", label: "Mon horaire", Icone: IconHoraire, href: "/moi/horaire" },
  { id: "demandes", label: "Demandes", Icone: IconDemande, href: "/moi/demandes" },
  { id: "discussion", label: "Discussion", Icone: IconDiscussion, href: "/moi/discussion" },
];

// Boutons de modules, affichés seulement si le module est actif.
const MODULES = [
  { id: "taches", label: "Tâches", Icone: IconTaches, href: "/moi/taches", module: "planning" },
  { id: "temperature", label: "Températures", Icone: IconTemperature, href: "/moi/temperature", module: "temperature" },
];

export default function AccueilEmploye() {
  const router = useRouter();
  const [moi, setMoi] = useState(null);

  useEffect(() => {
    employeFetch("/api/employe-app/moi").then(async (res) => {
      if (res.ok) setMoi(await res.json());
    });
  }, []);

  const modulesActifs = moi?.modulesActifs || [];
  const modules = MODULES.filter((m) => modulesActifs.includes(m.module));
  const prenom = moi?.employe?.nom?.split(" ")[0] || "";

  return (
    <div>
      <h2>Salut{prenom ? ` ${prenom}` : ""} !</h2>
      <p className="panel-hint">
        {moi?.entreprise?.nom ? `Bienvenue chez ${moi.entreprise.nom}.` : "Bienvenue."}
      </p>

      <PointageMobileBloc />

      <div className="moi-accueil-trio">
        {PRINCIPAUX.map((r) => (
          <button key={r.id} type="button" className="moi-accueil-card petite" onClick={() => router.push(r.href)}>
            <span className="moi-accueil-card-icon">
              <r.Icone className="gozly-icon" />
            </span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>

      {modules.length > 0 && (
        <>
          <p className="moi-accueil-section">Modules</p>
          <div className="moi-accueil-grid" style={{ marginTop: 0 }}>
            {modules.map((r) => (
              <button key={r.id} type="button" className="moi-accueil-card" onClick={() => router.push(r.href)}>
                <span className="moi-accueil-card-icon">
                  <r.Icone className="gozly-icon" />
                </span>
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
