import GestionShell from "@/components/gestion/GestionShell";
import AccueilGestion from "@/components/gestion/AccueilGestion";

export default function GestionAccueilPage() {
  return (
    <GestionShell actif="accueil">
      <AccueilGestion />
    </GestionShell>
  );
}
