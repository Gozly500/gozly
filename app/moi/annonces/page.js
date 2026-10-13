import MoiShell from "@/components/moi/MoiShell";
import AnnoncesPage from "@/components/moi/AnnoncesPage";

export const metadata = {
  title: "Gozly Équipe - Annonces et rappels",
};

export default function AnnoncesEmployePage() {
  return (
    <MoiShell>
      <AnnoncesPage />
    </MoiShell>
  );
}
