import PointageKioskContent from "@/components/PointageKioskContent";

export const metadata = {
  title: "Gozly - Pointage",
};

export default function PointagePage() {
  return (
    <div className="page dash-page">
      <PointageKioskContent />
    </div>
  );
}
