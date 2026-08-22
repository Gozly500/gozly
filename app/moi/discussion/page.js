import MoiShell from "@/components/moi/MoiShell";
import DiscussionEmploye from "@/components/moi/DiscussionEmploye";

export const metadata = {
  title: "Gozly Équipe - Discussion",
};

export default function DiscussionEmployePage() {
  return (
    <MoiShell>
      <DiscussionEmploye />
    </MoiShell>
  );
}
