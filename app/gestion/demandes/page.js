import GestionShell from "@/components/gestion/GestionShell";
import DemandesGestion from "@/components/gestion/DemandesGestion";

export default function GestionDemandesPage() {
  return (
    <GestionShell actif="demandes">
      <DemandesGestion />
    </GestionShell>
  );
}
