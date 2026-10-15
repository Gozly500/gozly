import { getT } from "@/lib/i18n/siteServer";
import KiosquesContent from "@/components/KiosquesContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Mode kiosque") };
}

export default function KiosquesPage() {
  return (
    <div className="page dash-page">
      <KiosquesContent />
    </div>
  );
}
