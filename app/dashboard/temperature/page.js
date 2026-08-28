import TemperatureContent from "@/components/TemperatureContent";

export const metadata = {
  title: "Gozly - Températures",
};

export default function TemperaturePage() {
  return (
    <div className="page page-default">
      <TemperatureContent />
    </div>
  );
}
