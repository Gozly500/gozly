import { getT } from "@/lib/i18n/siteServer";
import InventaireKioskContent from "@/components/InventaireKioskContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Liste à préparer") };
}

export default function InventaireKioskPage() {
  return (
    <div className="page dash-page">
      <InventaireKioskContent />
    </div>
  );
}
