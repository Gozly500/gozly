import { getT } from "@/lib/i18n/siteServer";
import CategoriesContent from "@/components/CategoriesContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Catégories") };
}

export default function CategoriesPage() {
  return (
    <div className="page dash-page">
      <CategoriesContent />
    </div>
  );
}
