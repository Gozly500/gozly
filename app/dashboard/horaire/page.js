import { getT } from "@/lib/i18n/siteServer";
import HoraireContent from "@/components/HoraireContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Horaire & Pointage") };
}

export default function HorairePage() {
  return (
    <div className="page dash-page">
      <HoraireContent />
    </div>
  );
}
