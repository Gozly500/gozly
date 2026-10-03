"use client";

import DiscussionSection from "@/components/discussion/DiscussionSection";
import { useGestion } from "@/components/gestion/GestionShell";

// Discussion de l'app gestionnaire : même chat que le dashboard (équipe, messages privés, groupes),
// présenté en une colonne à la fois pour le téléphone.
export default function DiscussionGestion() {
  const { entrepriseId, user } = useGestion();
  return (
    <div className="gestion-discussion">
      <DiscussionSection entrepriseId={entrepriseId} userId={user.id} mobile />
    </div>
  );
}
