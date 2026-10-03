import GestionShell from "@/components/gestion/GestionShell";
import FeuilleTempsMobile from "@/components/gestion/FeuilleTempsMobile";

export default function GestionHeuresPage() {
  return (
    <GestionShell actif="heures">
      <FeuilleTempsMobile />
    </GestionShell>
  );
}
