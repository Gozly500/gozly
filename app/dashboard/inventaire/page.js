import InventaireContent from "@/components/InventaireContent";

export const metadata = {
  title: "Gozly - Inventaire",
};

export default function InventairePage() {
  return (
    <div className="page page-default">
      <InventaireContent />
    </div>
  );
}
