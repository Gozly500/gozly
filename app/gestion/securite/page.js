import GestionShell from "@/components/gestion/GestionShell";
import SecuriteGestion from "@/components/gestion/SecuriteGestion";

export default function GestionSecuritePage() {
  return (
    <GestionShell actif="securite">
      <SecuriteGestion dansApp />
    </GestionShell>
  );
}
