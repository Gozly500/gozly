"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [noForfait, setNoForfait] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);

      supabase
        .from("admins")
        .select("id")
        .eq("email", session.user.email)
        .maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));

      // Vérifie si ce compte a une entreprise liée, et si elle a un forfait actif.
      // Les comptes sans profil (comme un compte admin créé manuellement)
      // ignorent simplement cette vérification.
      const { data: profil } = await supabase
        .from("profils")
        .select("entreprise_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profil?.entreprise_id) {
        const { data: entreprise } = await supabase
          .from("entreprises")
          .select("forfait")
          .eq("id", profil.entreprise_id)
          .maybeSingle();

        if (entreprise && !entreprise.forfait) {
          setNoForfait(true);
        }
      }

      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  const displayName =
    user?.user_metadata?.full_name || user?.user_metadata?.entreprise || user?.email;

  return (
    <div className="dash-layout">
      <button
        className={`dash-sidebar-tab${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label="Ouvrir le menu"
      >
        {sidebarOpen ? "‹" : "›"}
      </button>

      <aside className={`dash-sidebar${sidebarOpen ? " open" : ""}`}>
        <Link href="/" className="dash-sidebar-logo">
          <svg viewBox="0 0 1182 1182" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(0.136019,0,0,0.136019,590.551181,590.551181)">
              <g transform="matrix(1,0,0,1,-4341.666667,-4341.666667)">
                <g transform="matrix(1.736113,0,0,-1.736113,0,8680.555554)">
                  <g transform="matrix(1,0,0,1,193.559941,-68.202741)">
                    <path
                      d="M1330,4463C1251,4450 1107,4405 1035,4371C755,4240 546,4005 447,3709C407,3590 397,3500 402,3319C407,3180 411,3141 434,3065C502,2837 637,2636 820,2490L875,2447L878,2481C889,2610 939,2805 1000,2954C1144,3309 1421,3624 1755,3812C1919,3905 2178,3996 2332,4014C2388,4021 2389,4022 2378,4043C2359,4081 2208,4224 2136,4273C2007,4363 1857,4427 1710,4454C1634,4469 1396,4474 1330,4463Z"
                      style={{ fill: "white", fillRule: "nonzero" }}
                    />
                  </g>
                  <g transform="matrix(1,0,0,1,193.559941,-68.202741)">
                    <path
                      d="M2437,3920C1945,3858 1524,3603 1258,3205C1072,2927 980,2626 980,2292C980,2109 996,1998 1044,1838C1182,1385 1469,1042 1885,835C2034,761 2151,720 2312,688C2407,669 2455,665 2610,666C2769,667 2812,671 2920,693C3095,730 3214,770 3365,844C3531,925 3648,1009 3775,1135C3978,1338 4120,1606 4180,1899C4218,2089 4225,2364 4195,2548C4176,2666 4145,2792 4136,2796C4125,2800 2593,2407 2585,2398C2580,2393 2724,1853 2732,1844C2736,1841 2915,1884 3130,1940C3345,1997 3523,2040 3527,2037C3539,2024 3509,1923 3471,1848C3392,1689 3255,1558 3072,1462C2895,1371 2720,1331 2540,1344C2308,1360 2113,1447 1946,1609C1651,1895 1568,2330 1740,2697C1860,2955 2068,3130 2355,3217C2437,3241 2460,3244 2610,3244C2753,3245 2786,3242 2854,3222C2996,3181 3122,3113 3236,3015L3277,2980L3481,3162C3593,3261 3707,3363 3734,3387L3783,3431L3759,3456C3722,3497 3591,3603 3525,3647C3386,3739 3166,3838 3020,3874C2835,3919 2583,3939 2437,3920Z"
                      style={{ fill: "white", fillRule: "nonzero" }}
                    />
                  </g>
                  <g transform="matrix(1,0,0,1,193.559941,-68.202741)">
                    <path
                      d="M2435,3120C2315,3093 2226,3056 2135,2995C1923,2854 1788,2623 1764,2361L1757,2287L1783,2294C2070,2366 2343,2584 2480,2851C2528,2945 2580,3085 2580,3121C2580,3145 2544,3145 2435,3120Z"
                      style={{ fill: "white", fillRule: "nonzero" }}
                    />
                  </g>
                </g>
              </g>
            </g>
          </svg>
          <span>Gozly</span>
        </Link>

        <nav className="dash-nav">
          <div className="dash-nav-item active">
            <span>▦</span> Tableau de bord
          </div>
          <div className="dash-nav-label">Modules</div>
          <div className="dash-nav-item disabled">
            <span>+</span> Aucun module activé
          </div>
        </nav>

        <div className="dash-sidebar-user">
          <div className="dash-user-header">
            <div>
              <div className="dash-user-name">{displayName}</div>
              {displayName !== user?.email && <div className="dash-user-email">{user?.email}</div>}
            </div>
          </div>
          <div className="dash-user-actions">
            {isAdmin && (
              <Link href="/admin" className="dash-settings-btn" title="Panneau admin">
                🛡
              </Link>
            )}
            <Link href="/parametres" className="dash-settings-btn" title="Paramètres du compte">
              ⚙
            </Link>
            <button onClick={handleLogout} className="dash-logout-btn">
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      <main className="dash-main">
        <div className="dash-main-inner">
          {noForfait && (
            <div className="dash-forfait-banner">
              <span>Vous n'avez aucun forfait actif.</span>
              <Link href="/s-abonner" className="dash-forfait-banner-btn">
                Choisir un forfait →
              </Link>
            </div>
          )}

          <header className="dash-hero-inline">
            <h1>Bienvenue{displayName ? `, ${displayName}` : ""}</h1>
            <p>Voici ton espace. Active un module pour commencer.</p>
          </header>

          <div className="dash-modules-grid">
            <div className="dash-module-card">+</div>
            <div className="dash-module-card">+</div>
            <div className="dash-module-card">+</div>
            <div className="dash-module-card">+</div>
          </div>
        </div>
      </main>
    </div>
  );
}
