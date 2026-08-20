import DashboardContent from "@/components/DashboardContent";

export const metadata = {
  title: "Gozly - Tableau de bord",
};

export default function DashboardPage() {
  return (
    <div className="page page-default">
      <DashboardContent />
    </div>
  );
}
