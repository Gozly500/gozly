import GestionShell from "@/components/gestion/GestionShell";
import CommandesGestion from "@/components/gestion/CommandesGestion";

export default function GestionCommandesPage() {
  return (
    <GestionShell actif="commandes">
      <CommandesGestion />
    </GestionShell>
  );
}
