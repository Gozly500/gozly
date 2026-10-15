import { getT } from "@/lib/i18n/siteServer";
import PlanningContent from "@/components/PlanningContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Tâches") };
}

export default function PlanningPage() {
  return (
    <div className="page dash-page">
      <PlanningContent />
    </div>
  );
}
