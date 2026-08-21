import EmployesContent from "@/components/EmployesContent";

export const metadata = {
  title: "Gozly - Employés",
};

export default function EmployesPage() {
  return (
    <div className="page page-default">
      <EmployesContent />
    </div>
  );
}
