import JourContent from "@/components/JourContent";

export const metadata = {
  title: "Gozly - Journée",
};

export default async function JourPage({ params }) {
  const { date } = await params;

  return (
    <div className="page page-default">
      <JourContent date={date} />
    </div>
  );
}
