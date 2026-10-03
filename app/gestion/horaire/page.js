import GestionShell from "@/components/gestion/GestionShell";
import HorairePageGestion from "@/components/gestion/HorairePageGestion";

export default function GestionHorairePage() {
  return (
    <GestionShell actif="horaire">
      <HorairePageGestion />
    </GestionShell>
  );
}
