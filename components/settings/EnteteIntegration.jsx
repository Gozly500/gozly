"use client";

import { useT } from "@/components/LangProvider";
import LogoIntegration from "@/components/settings/LogoIntegration";
import { catalogue, categorieDe } from "@/lib/integrationsCatalogue";

const ETATS = {
  connecte: { texte: "Connecté", classe: "active" },
  en_attente: { texte: "En attente", classe: "" },
  a_reconnecter: { texte: "À reconnecter", classe: "inactive" },
  deconnecte: { texte: "Non connecté", classe: "" },
};

// En-tête commun des pages d'intégration : tuile du service, nom, catégorie, description et état de la connexion.
export default function EnteteIntegration({ id, etat }) {
  const { t } = useT();
  const i = catalogue().find((x) => x.id === id);
  if (!i) return null;
  const e = ETATS[etat];
  return (
    <div className="entete-integration">
      <LogoIntegration i={i} />
      <div className="entete-integration-texte">
        <h2>{t(i.nom)}</h2>
        <p>{t(i.description)}</p>
      </div>
      <div className="entete-integration-etat">
        <span className="entete-integration-cat">{t(categorieDe(i.categorie)?.label)}</span>
        {e && <span className={`admin-status-pill ${e.classe}`}>{t(e.texte)}</span>}
      </div>
    </div>
  );
}
