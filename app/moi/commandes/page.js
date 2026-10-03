import MoiShell from "@/components/moi/MoiShell";
import CommandesEmploye from "@/components/moi/CommandesEmploye";

export const metadata = {
  title: "Gozly Équipe - Réservations",
};

export default function CommandesEmployePage() {
  return (
    <MoiShell>
      <CommandesEmploye />
    </MoiShell>
  );
}
