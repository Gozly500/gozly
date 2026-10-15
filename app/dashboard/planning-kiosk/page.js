import { getT } from "@/lib/i18n/siteServer";
import PlanningKioskContent from "@/components/PlanningKioskContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Tâches du jour") };
}

export default function PlanningKioskPage() {
  return (
    <div className="page dash-page">
      <PlanningKioskContent />
    </div>
  );
}
