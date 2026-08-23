import MoiShell from "@/components/moi/MoiShell";
import TachesEmploye from "@/components/moi/TachesEmploye";

export const metadata = {
  title: "Gozly Équipe - Tâches",
};

export default function TachesEmployePage() {
  return (
    <MoiShell>
      <TachesEmploye />
    </MoiShell>
  );
}
