import { getT } from "@/lib/i18n/siteServer";
import DashboardsContent from "@/components/DashboardsContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Choisir un dashboard") };
}

export default function DashboardsPage() {
  return <DashboardsContent />;
}
