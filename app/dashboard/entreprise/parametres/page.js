import { getT } from "@/lib/i18n/siteServer";
import EntrepriseParametresContent from "@/components/EntrepriseParametresContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Paramètres") };
}

export default function EntrepriseParametresPage() {
  return (
    <div className="page dash-page">
      <EntrepriseParametresContent />
    </div>
  );
}
