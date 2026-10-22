/** @type {import('next').NextConfig} */
const nextConfig = {
  // Clé publique Supabase (« publishable »). Vercel refuse un nom en NEXT_PUBLIC_ pour une variable « Sensitive »
  // (réglage imposé par l'équipe): la variable s'appelle donc SUPABASE_PUBLISHABLE_KEY et Next.js l'inscrit dans le
  // code (navigateur et serveur) au moment de la construction, sous le nom SUPABASE_CLE_PUBLIQUE. Cette clé est publique
  // par conception: la protection vient des règles RLS de la base, pas du secret.
  env: {
    // Valeur de secours: la clé publishable actuelle (publique, la même que dans les logiciels Gozly). SUPABASE_PUBLISHABLE_KEY
    // (Vercel) la remplace si elle est définie. On n'utilise plus NEXT_PUBLIC_SUPABASE_ANON_KEY (ancienne clé supprimée).
    SUPABASE_CLE_PUBLIQUE: process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_vCl2dCuoWiQT_5mAvMGx3g_wlPig2pg",
  },
  async redirects() {
    return [
      { source: "/scategories", destination: "/scattegories", permanent: true },
      { source: "/scategories/:path*", destination: "/scattegories/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
