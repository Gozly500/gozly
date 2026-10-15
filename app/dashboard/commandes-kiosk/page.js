import { getT } from "@/lib/i18n/siteServer";
import CommandesKioskContent from "@/components/CommandesKioskContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Kiosque des commandes") };
}

export default function CommandesKioskPage() {
  return (
    <div className="page dash-page">
      <CommandesKioskContent />
    </div>
  );
}
