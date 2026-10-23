"use client";

import { useGestion } from "@/components/gestion/GestionShell";
import { useT } from "@/components/LangProvider";
import { LangueProvider } from "@/components/moi/LangueContext";
import MusiqueEpingle from "@/components/kiosque/MusiqueEpingle";

// Musique dans l'app gestionnaire : le même lecteur que le kiosque Musique (haut-parleurs, plateformes, listes de lecture,
// volume), qui s'empile en une colonne sur un téléphone. demo : données fictives (aperçu local seulement).
export default function MusiqueGestion({ demo = false }) {
  const { lang } = useT();
  const gestion = useGestion();
  const entrepriseId = gestion?.entrepriseId || (demo ? "demo" : null);
  if (!entrepriseId) return null;
  return (
    <div>
      <LangueProvider forcee={lang}>
        <MusiqueEpingle mode="plein" entrepriseId={entrepriseId} demo={demo} />
      </LangueProvider>
    </div>
  );
}
