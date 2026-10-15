import { getT } from "@/lib/i18n/siteServer";
import EmployesContent from "@/components/EmployesContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Employés") };
}

export default function EmployesPage() {
  return (
    <div className="page dash-page">
      <EmployesContent />
    </div>
  );
}
