import TemperatureEquipementsContent from "@/components/TemperatureEquipementsContent";

export const metadata = {
  title: "Gozly - Équipements (Températures)",
};

export default function TemperatureEquipementsPage() {
  return (
    <div className="page page-default">
      <TemperatureEquipementsContent />
    </div>
  );
}
