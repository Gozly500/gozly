import MoiShell from "@/components/moi/MoiShell";
import DemandesEmploye from "@/components/moi/DemandesEmploye";

export const metadata = {
  title: "Gozly Équipe - Demandes",
};

export default function DemandesEmployePage() {
  return (
    <MoiShell>
      <DemandesEmploye />
    </MoiShell>
  );
}
