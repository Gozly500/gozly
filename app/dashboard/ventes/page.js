import { getT } from "@/lib/i18n/siteServer";
import VentesContent from "@/components/VentesContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Suivi des ventes") };
}

export default function VentesPage() {
  return <VentesContent />;
}
