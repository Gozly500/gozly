import DashboardThemeLayout from "@/app/dashboard/layout";

export const metadata = {
  title: "Gozly Gestion",
  manifest: "/manifest-gestion.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Gozly Gestion" },
  icons: { icon: "/icone-gestion-192?v=2", apple: "/icone-gestion-192?v=2" },
};

export const viewport = {
  themeColor: "#191960",
};

// App mobile du gestionnaire : même thème que le dashboard (réglage du compte).
export default function GestionLayout({ children }) {
  return (
    <DashboardThemeLayout>
      <div className="page moi-page gestion-page">{children}</div>
    </DashboardThemeLayout>
  );
}
