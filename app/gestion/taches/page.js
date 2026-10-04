import GestionShell from "@/components/gestion/GestionShell";
import TachesGestion from "@/components/gestion/TachesGestion";

export default function GestionTachesPage() {
  return (
    <GestionShell actif="taches">
      <TachesGestion />
    </GestionShell>
  );
}
