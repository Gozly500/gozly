import { getT } from "@/lib/i18n/siteServer";
import PointageKioskContent from "@/components/PointageKioskContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Pointage") };
}

export default function PointagePage() {
  return (
    <div className="page dash-page">
      <PointageKioskContent />
    </div>
  );
}
