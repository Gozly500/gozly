export const metadata = {
  title: "Gozly Équipe",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Gozly Équipe" },
  icons: { icon: "/icone-app-192", apple: "/icone-app-192" },
};

export const viewport = {
  themeColor: "#191960",
};

export default function MoiLayout({ children }) {
  return <div className="page page-default moi-page">{children}</div>;
}
