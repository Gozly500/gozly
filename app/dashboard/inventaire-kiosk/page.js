import InventaireKioskContent from "@/components/InventaireKioskContent";

export const metadata = {
  title: "Gozly - Liste à préparer",
};

export default function InventaireKioskPage() {
  return (
    <div className="page page-default">
      <InventaireKioskContent />
    </div>
  );
}
