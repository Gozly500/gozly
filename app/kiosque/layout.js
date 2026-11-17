import KiosqueThemeAppliqueur from "@/components/kiosque/KiosqueThemeAppliqueur";
import { LangueProvider } from "@/components/moi/LangueContext";
import EcranVerrouillageNip from "@/components/kiosque/EcranVerrouillageNip";
import GardeKiosqueEpingle from "@/components/kiosque/GardeKiosqueEpingle";

export const metadata = {
  title: "Gozly Kiosque",
  manifest: "/manifest-kiosque.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Gozly Kiosque" },
  icons: { icon: "/icone-kiosque-192.png?v=3", apple: "/icone-kiosque-192.png?v=3" },
};

export const viewport = {
  themeColor: "#191960",
};

// App tablette « Gozly Kiosque » : thème et langue propres à la tablette (voir /kiosque/reglages), installable en plein écran.
export default function KiosqueLayout({ children }) {
  return (
    <div className="page dash-page">
      <KiosqueThemeAppliqueur />
      <LangueProvider>
        {children}
        <GardeKiosqueEpingle />
        <EcranVerrouillageNip />
      </LangueProvider>
    </div>
  );
}
