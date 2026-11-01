import GestionShell from "@/components/gestion/GestionShell";
import TemperatureGestion from "@/components/gestion/TemperatureGestion";

export default function GestionTemperaturePage() {
  return (
    <GestionShell actif="temperature">
      <TemperatureGestion />
    </GestionShell>
  );
}
