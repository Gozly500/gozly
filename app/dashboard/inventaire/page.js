import { getT } from "@/lib/i18n/siteServer";
import InventaireContent from "@/components/InventaireContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Inventaire") };
}

export default function InventairePage() {
  return (
    <div className="page dash-page">
      <InventaireContent />
    </div>
  );
}
