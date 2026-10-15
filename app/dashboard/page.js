import { getT } from "@/lib/i18n/siteServer";
import DashboardContent from "@/components/DashboardContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Tableau de bord") };
}

export default function DashboardPage() {
  return (
    <div className="page dash-page">
      <DashboardContent />
    </div>
  );
}
