import CategoriesInventaireContent from "@/components/CategoriesInventaireContent";

export const metadata = {
  title: "Gozly - Catégories d'inventaire",
};

export default function CategoriesInventairePage() {
  return (
    <div className="page dash-page">
      <CategoriesInventaireContent />
    </div>
  );
}
