import MoiShell from "@/components/moi/MoiShell";
import HoraireEmploye from "@/components/moi/HoraireEmploye";

export const metadata = {
  title: "Gozly Équipe - Horaire",
};

export default function HorairePage() {
  return (
    <MoiShell>
      <HoraireEmploye />
    </MoiShell>
  );
}
