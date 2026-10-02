import CommandesKioskContent from "@/components/CommandesKioskContent";

export const metadata = {
  title: "Gozly - Kiosque des commandes",
};

export default function CommandesKioskPage() {
  return (
    <div className="page dash-page">
      <CommandesKioskContent />
    </div>
  );
}
