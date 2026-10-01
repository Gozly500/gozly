import PlanningKioskContent from "@/components/PlanningKioskContent";

export const metadata = {
  title: "Gozly - Tâches du jour",
};

export default function PlanningKioskPage() {
  return (
    <div className="page dash-page">
      <PlanningKioskContent />
    </div>
  );
}
