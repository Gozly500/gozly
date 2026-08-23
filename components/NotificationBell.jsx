"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { compterNotifications } from "@/lib/notifications";

export default function NotificationBell({ entrepriseId }) {
  const [userId, setUserId] = useState(null);
  const [compteurs, setCompteurs] = useState({ chat: 0, demandes: 0, inventaire: 0, total: 0 });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null));
  }, []);

  useEffect(() => {
    if (!entrepriseId || !userId) return;

    function charger() {
      compterNotifications(supabase, { entrepriseId, userId }).then(setCompteurs);
    }

    charger();
    pollRef.current = setInterval(charger, 4000);
    return () => clearInterval(pollRef.current);
  }, [entrepriseId, userId]);

  useEffect(() => {
    function onClickDehors(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickDehors);
    return () => document.removeEventListener("mousedown", onClickDehors);
  }, []);

  if (!entrepriseId) return null;

  const ITEMS = [
    { label: "Messages non lus", count: compteurs.chat, href: "/dashboard/discussion" },
    { label: "Demandes à traiter", count: compteurs.demandes, href: "/dashboard/horaire?tab=demandes" },
    { label: "Produits en alerte de stock", count: compteurs.inventaire, href: "/dashboard/inventaire" },
  ];

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="notif-bell-btn"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        🔔
        {compteurs.total > 0 && <span className="notif-badge">{compteurs.total > 9 ? "9+" : compteurs.total}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          {compteurs.total === 0 ? (
            <div className="notif-dropdown-empty">Aucune notification.</div>
          ) : (
            ITEMS.filter((item) => item.count > 0).map((item) => (
              <Link key={item.href} href={item.href} className="notif-dropdown-item" onClick={() => setOpen(false)}>
                <span>{item.label}</span>
                <span>{item.count}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
