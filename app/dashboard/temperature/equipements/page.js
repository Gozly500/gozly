import { getT } from "@/lib/i18n/siteServer";
import TemperatureEquipementsContent from "@/components/TemperatureEquipementsContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Équipements (Températures)") };
}

export default function TemperatureEquipementsPage() {
  return (
    <div className="page dash-page">
      <TemperatureEquipementsContent />
    </div>
  );
}
