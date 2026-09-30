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
import { useLangue } from "@/components/moi/LangueContext";

// Les 3 pages de base, en petites cases sur une seule ligne.
const PRINCIPAUX = [
  { id: "horaire", cle: "home.horaire", Icone: IconHoraire, href: "/moi/horaire" },
  { id: "demandes", cle: "nav.demandes", Icone: IconDemande, href: "/moi/demandes" },
  { id: "discussion", cle: "nav.discussion", Icone: IconDiscussion, href: "/moi/discussion" },
];

// Boutons de modules, affichés seulement si le module est actif.
const MODULES = [
  { id: "taches", cle: "nav.taches", Icone: IconTaches, href: "/moi/taches", module: "planning" },
  { id: "temperature", cle: "nav.temperature", Icone: IconTemperature, href: "/moi/temperature", module: "temperature" },
];

export default function AccueilEmploye() {
  const router = useRouter();
  const { t } = useLangue();
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
      <h2>{t("home.salut")}{prenom ? ` ${prenom}` : ""} !</h2>
      <p className="panel-hint">
        {moi?.entreprise?.nom ? t("home.bienvenueAvecNom", { nom: moi.entreprise.nom }) : t("home.bienvenue")}
      </p>

      <PointageMobileBloc />

      <div className="moi-accueil-trio">
        {PRINCIPAUX.map((r) => (
          <button key={r.id} type="button" className="moi-accueil-card petite" onClick={() => router.push(r.href)}>
            <span className="moi-accueil-card-icon">
              <r.Icone className="gozly-icon" />
            </span>
            <span>{t(r.cle)}</span>
          </button>
        ))}
      </div>

      {modules.length > 0 && (
        <>
          <p className="moi-accueil-section">{t("home.modules")}</p>
          <div className="moi-accueil-grid" style={{ marginTop: 0 }}>
            {modules.map((r) => (
              <button key={r.id} type="button" className="moi-accueil-card" onClick={() => router.push(r.href)}>
                <span className="moi-accueil-card-icon">
                  <r.Icone className="gozly-icon" />
                </span>
                <span>{t(r.cle)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
