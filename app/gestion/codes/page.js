import GestionShell from "@/components/gestion/GestionShell";
import CodesGestion from "@/components/gestion/CodesGestion";

export default function GestionCodesPage() {
  return (
    <GestionShell actif="codes">
      <CodesGestion />
    </GestionShell>
  );
}
