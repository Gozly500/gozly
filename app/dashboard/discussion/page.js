import { getT } from "@/lib/i18n/siteServer";
import DiscussionContent from "@/components/DiscussionContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Discussion") };
}

export default function DiscussionPage() {
  return (
    <div className="page dash-page">
      <DiscussionContent />
    </div>
  );
}
