"use client";

import { useEffect, useRef, useState } from "react";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { IconFlecheBas } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import LangSwitch from "@/components/LangSwitch";
import PageDecor from "@/components/PageDecor";
import HomeFx from "@/components/HomeFx";
import { lireDemandeDeveloppeur } from "@/lib/developpeur";

export default function Nav() {
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [estDeveloppeur, setEstDeveloppeur] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  useFermerAuClicExterieur(accountRef, accountOpen, () => setAccountOpen(false));

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setEstDeveloppeur(false);
      return;
    }
    lireDemandeDeveloppeur(user.id).then((d) => setEstDeveloppeur(d?.statut === "approuvee"));
  }, [user]);

  useEffect(() => {
    if (!user?.email) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("admins")
      .select("id")
      .eq("email", user.email)
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  async function handleLogout() {
    await supabase.auth.signOut({ scope: "local" });
    setAccountOpen(false);
    setMobileOpen(false);
    router.push("/login");
  }

  return (
    <>
      <PageDecor />
      <HomeFx />
    <div className="navbar">
      <div className="navpill">
        <div className="nav-logo-spacer">
          <span className="g-mark">
            <img src="/gozly-logo-noel.svg" alt="Gozly" />
          </span>
        </div>
        <div className="nav-links desktop-only">
          <Link href="/" className={pathname === "/" ? "active" : ""}>
            {t("nav.accueil")}
          </Link>
          <Link href="/s-abonner" className={pathname === "/s-abonner" ? "active" : ""}>
            {t("nav.abonner")}
          </Link>
          <Link href="/telecharger" className={pathname === "/telecharger" ? "active" : ""}>
            {t("nav.logiciels")}
          </Link>
          <Link href="/contact" className={pathname === "/contact" ? "active" : ""}>
            {t("nav.contact")}
          </Link>
        </div>

        <div className="desktop-only">
          {user ? (
            <div className="account-wrap" ref={accountRef}>
              <button className="account-btn" onClick={() => setAccountOpen((v) => !v)}>
                {t("nav.compte")} <IconFlecheBas className="gozly-icon-inline" />
              </button>
              {accountOpen && (
                <div className="account-dropdown open">
                  <Link href="/dashboard" onClick={() => setAccountOpen(false)}>
                    {t("nav.dashboard")}
                  </Link>
                  {estDeveloppeur && (
                    <Link href="/developpeur" onClick={() => setAccountOpen(false)}>
                      {t("Espace développeur")}
                    </Link>
                  )}
                  <Link href="/parametres" onClick={() => setAccountOpen(false)}>
                    {t("nav.parametres")}
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" onClick={() => setAccountOpen(false)}>
                      {t("nav.admin")}
                    </Link>
                  )}
                  <div className="divider"></div>
                  <button className="logout" onClick={handleLogout}>
                    {t("nav.deconnexion")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="btn-navy">
              {t("nav.connexion")}
            </Link>
          )}
        </div>

        <button
          className={`hamburger-btn mobile-only${mobileOpen ? " open" : ""}`}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={t("nav.menu")}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <LangSwitch />
      </div>

      <div className={`mobile-menu-panel${mobileOpen ? " open" : ""}`}>
        <Link href="/" onClick={() => setMobileOpen(false)}>
          {t("nav.accueil")}
        </Link>
        <Link href="/s-abonner" onClick={() => setMobileOpen(false)}>
          {t("nav.abonner")}
        </Link>
        <Link href="/telecharger" onClick={() => setMobileOpen(false)}>
          {t("nav.logiciels")}
        </Link>
        <Link href="/contact" onClick={() => setMobileOpen(false)}>
          {t("nav.contact")}
        </Link>
        {user ? (
          <>
            <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
              {t("nav.dashboard")}
            </Link>
            {estDeveloppeur && (
              <Link href="/developpeur" onClick={() => setMobileOpen(false)}>
                {t("Espace développeur")}
              </Link>
            )}
            <Link href="/parametres" onClick={() => setMobileOpen(false)}>
              {t("nav.parametres")}
            </Link>
            {isAdmin && (
              <Link href="/admin" onClick={() => setMobileOpen(false)}>
                {t("nav.admin")}
              </Link>
            )}
            <button onClick={handleLogout} className="mobile-logout">
              {t("nav.deconnexion")}
            </button>
          </>
        ) : (
          <Link href="/login" onClick={() => setMobileOpen(false)}>
            {t("nav.connexion")}
          </Link>
        )}
      </div>
    </div>
    </>
  );
}
