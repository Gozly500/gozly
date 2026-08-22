import PlanningKioskContent from "@/components/PlanningKioskContent";

export const metadata = {
  title: "Gozly - Planning du jour",
};

export default function PlanningKioskPage() {
  return (
    <div className="page page-default">
      <PlanningKioskContent />
    </div>
  );
}
