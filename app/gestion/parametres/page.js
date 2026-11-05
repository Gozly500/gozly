import GestionShell from "@/components/gestion/GestionShell";
import ParametresGestion from "@/components/gestion/ParametresGestion";

export default function GestionParametresPage() {
  return (
    <GestionShell actif="parametres">
      <ParametresGestion />
    </GestionShell>
  );
}
