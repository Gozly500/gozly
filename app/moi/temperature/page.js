import MoiShell from "@/components/moi/MoiShell";
import TemperatureEmploye from "@/components/moi/TemperatureEmploye";

export const metadata = {
  title: "Gozly Équipe - Températures",
};

export default function TemperatureEmployePage() {
  return (
    <MoiShell>
      <TemperatureEmploye />
    </MoiShell>
  );
}
