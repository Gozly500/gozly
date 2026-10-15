import { getT } from "@/lib/i18n/siteServer";
import CommandesContent from "@/components/CommandesContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Commandes") };
}

export default function CommandesPage() {
  return <CommandesContent />;
}
