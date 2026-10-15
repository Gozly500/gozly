import { getT } from "@/lib/i18n/siteServer";
import InvitationsContent from "@/components/InvitationsContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Invitations") };
}

export default function InvitationsPage() {
  return <InvitationsContent />;
}
