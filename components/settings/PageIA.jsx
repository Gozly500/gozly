"use client";

import { useState } from "react";
import ConnexionsIA from "@/components/settings/ConnexionsIA";
import PermissionsIA from "@/components/settings/PermissionsIA";
import { useT } from "@/components/LangProvider";

// Page de l'intégration « Assistants IA » : deux onglets au lieu d'une longue page.
export default function PageIA({ entrepriseId }) {
  const { t } = useT();
  const [onglet, setOnglet] = useState("connexion");
  return (
    <div>
      <div className="page-onglets" role="tablist">
        {[
          { id: "connexion", label: "Connexion" },
          { id: "permissions", label: "Permissions" },
        ].map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={onglet === o.id} className={`page-onglet${onglet === o.id ? " actif" : ""}`} onClick={() => setOnglet(o.id)}>
            {t(o.label)}
          </button>
        ))}
      </div>
      <div style={{ marginTop: "16px" }}>
        {onglet === "connexion" ? <ConnexionsIA entrepriseId={entrepriseId} /> : <PermissionsIA entrepriseId={entrepriseId} />}
      </div>
    </div>
  );
}
