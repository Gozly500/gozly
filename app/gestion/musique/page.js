import GestionShell from "@/components/gestion/GestionShell";
import MusiqueGestion from "@/components/gestion/MusiqueGestion";

export default function GestionMusiquePage() {
  return (
    <GestionShell actif="musique">
      <MusiqueGestion />
    </GestionShell>
  );
}
