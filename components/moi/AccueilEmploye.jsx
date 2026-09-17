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
  IconParametres,
} from "@/components/icons/GozlyIcons";

const RACCOURCIS = [
  { id: "horaire", label: "Mon horaire", Icone: IconHoraire, href: "/moi/horaire" },
  { id: "demandes", label: "Demandes", Icone: IconDemande, href: "/moi/demandes" },
  { id: "discussion", label: "Discussion", Icone: IconDiscussion, href: "/moi/discussion" },
  { id: "taches", label: "Tâches", Icone: IconTaches, href: "/moi/taches", module: "planning" },
  { id: "temperature", label: "Températures", Icone: IconTemperature, href: "/moi/temperature", module: "temperature" },
  { id: "parametres", label: "Paramètres", Icone: IconParametres, href: "/moi/parametres" },
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
  const raccourcis = RACCOURCIS.filter((r) => !r.module || modulesActifs.includes(r.module));
  const prenom = moi?.employe?.nom?.split(" ")[0] || "";

  return (
    <div>
      <h2>Salut{prenom ? ` ${prenom}` : ""} !</h2>
      <p className="panel-hint">
        {moi?.entreprise?.nom ? `Bienvenue chez ${moi.entreprise.nom}.` : "Bienvenue."}
      </p>

      <div className="moi-accueil-grid">
        {raccourcis.map((r) => (
          <button key={r.id} type="button" className="moi-accueil-card" onClick={() => router.push(r.href)}>
            <span className="moi-accueil-card-icon">
              <r.Icone className="gozly-icon" />
            </span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
