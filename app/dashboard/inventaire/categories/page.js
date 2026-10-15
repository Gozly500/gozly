import { getT } from "@/lib/i18n/siteServer";
import CategoriesInventaireContent from "@/components/CategoriesInventaireContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Catégories d'inventaire") };
}

export default function CategoriesInventairePage() {
  return (
    <div className="page dash-page">
      <CategoriesInventaireContent />
    </div>
  );
}
