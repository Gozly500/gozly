import { getT } from "@/lib/i18n/siteServer";
import JourContent from "@/components/JourContent";

export function generateMetadata() {
  return { title: getT().t("Gozly - Journée") };
}

export default async function JourPage({ params }) {
  const { date } = await params;

  return (
    <div className="page dash-page">
      <JourContent date={date} />
    </div>
  );
}
