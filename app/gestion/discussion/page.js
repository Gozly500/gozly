import GestionShell from "@/components/gestion/GestionShell";
import DiscussionGestion from "@/components/gestion/DiscussionGestion";

export default function GestionDiscussionPage() {
  return (
    <GestionShell actif="discussion">
      <DiscussionGestion />
    </GestionShell>
  );
}
