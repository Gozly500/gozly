import { getT } from "@/lib/i18n/siteServer";
import MusiqueContent from "@/components/MusiqueContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Musique") };
}

export default function MusiquePage() {
  return (
    <div className="page dash-page">
      <MusiqueContent />
    </div>
  );
}
