import MoiShell from "@/components/moi/MoiShell";
import AccueilEmploye from "@/components/moi/AccueilEmploye";

export const metadata = {
  title: "Gozly Équipe",
};

export default function AccueilEmployePage() {
  return (
    <MoiShell>
      <AccueilEmploye />
    </MoiShell>
  );
}
