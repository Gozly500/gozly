import DashboardThemeLayout from "@/app/dashboard/layout";

export const metadata = {
  title: "Gozly Kiosque",
  manifest: "/manifest-kiosque.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Gozly Kiosque" },
  icons: { icon: "/icone-kiosque-192?v=2", apple: "/icone-kiosque-192" },
};

export const viewport = {
  themeColor: "#191960",
};

// App tablette « Gozly Kiosque » : même thème que le dashboard, installable en plein écran.
export default function KiosqueLayout({ children }) {
  return (
    <DashboardThemeLayout>
      <div className="page dash-page">{children}</div>
    </DashboardThemeLayout>
  );
}
