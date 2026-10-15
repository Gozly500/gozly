import { getT } from "@/lib/i18n/siteServer";
import TemperatureContent from "@/components/TemperatureContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Températures") };
}

export default function TemperaturePage() {
  return (
    <div className="page dash-page">
      <TemperatureContent />
    </div>
  );
}
