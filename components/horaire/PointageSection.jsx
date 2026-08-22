"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PointageSection({ entrepriseId }) {
  const [nip, setNip] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementId] = useState(null);
  const [emplacementsLoaded, setEmplacementsLoaded] = useState(false);
  const lottieRef = useRef(null);

  const storageKey = `gozly_emplacement_id_${entrepriseId}`;

  useEffect(() => {
    supabase
      .from("emplacements")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const list = data || [];
        setEmplacements(list);

        if (list.length > 0) {
          const saved = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
          if (saved && list.some((e) => e.id === saved)) {
            setEmplacementId(saved);
          }
        }
        setEmplacementsLoaded(true);
      });
  }, [entrepriseId]);

  function choisirEmplacement(id) {
    setEmplacementId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, id);
  }

  useEffect(() => {
    if (!showSuccess || !lottieRef.current) return;

    let anim;
    let cancelled = false;

    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !lottieRef.current) return;
      anim = lottie.loadAnimation({
        container: lottieRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: "/animations/pointage-succes.json",
      });
      // L'animation dure ~2.8s, plus courte que le délai d'affichage voulu
      // (4s) - on la laisse simplement se terminer sans rien effacer, c'est
      // le minuteur ci-dessous qui décide quand tout disparaît.
    });

    const minuteur = setTimeout(() => {
      setShowSuccess(false);
      setMessage(null);
    }, 4000);

    return () => {
      cancelled = true;
      anim?.destroy();
      clearTimeout(minuteur);
    };
  }, [showSuccess]);

  function pressDigit(d) {
    if (busy || nip.length >= 4) return;
    setMessage(null);
    setNip((n) => n + d);
  }

  function pressClear() {
    setNip("");
    setMessage(null);
  }

  async function handleConfirm() {
    if (!nip) return;
    setBusy(true);
    setMessage(null);

    const { data: employe } = await supabase
      .from("employes")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .eq("nip", nip)
      .maybeSingle();

    if (!employe) {
      setMessage({ type: "err", text: "NIP invalide." });
      setNip("");
      setBusy(false);
      return;
    }

    // Un quart "ouvert" (entree posée, sortie pas encore posée) = l'employé
    // est actuellement au travail. On le termine plutôt que d'en créer un
    // nouveau.
    const { data: enCours, error: lectureError } = await supabase
      .from("pointages")
      .select("id")
      .eq("employe_id", employe.id)
      .is("sortie", null)
      .order("entree", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lectureError) {
      setMessage({ type: "err", text: "Erreur : " + lectureError.message });
      setNip("");
      setBusy(false);
      return;
    }

    const maintenant = new Date().toISOString();
    let prochainType;

    if (enCours) {
      const { error: updateError } = await supabase.from("pointages").update({ sortie: maintenant }).eq("id", enCours.id);
      if (updateError) {
        setMessage({ type: "err", text: "Erreur : " + updateError.message });
        setNip("");
        setBusy(false);
        return;
      }
      prochainType = "depart";
    } else {
      const { error: insertError } = await supabase
        .from("pointages")
        .insert({ entreprise_id: entrepriseId, employe_id: employe.id, entree: maintenant, emplacement_id: emplacementId });
      if (insertError) {
        setMessage({ type: "err", text: "Erreur : " + insertError.message });
        setNip("");
        setBusy(false);
        return;
      }
      prochainType = "arrivee";
    }

    const heure = new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });

    setMessage({
      type: "ok",
      text:
        prochainType === "arrivee"
          ? `Bonjour ${employe.nom} ! Arrivée enregistrée à ${heure}.`
          : `Au revoir ${employe.nom} ! Départ enregistré à ${heure}.`,
    });
    setNip("");
    setBusy(false);
    setShowSuccess(true);
  }

  if (emplacementsLoaded && emplacements.length > 1 && !emplacementId) {
    return (
      <div>
        <h2>Quel emplacement ?</h2>
        <p className="panel-hint">Choisis la succursale de cette tablette (mémorisé pour la prochaine fois).</p>
        <div className="modules-picker-grid" style={{ maxWidth: "360px", margin: "0 auto" }}>
          {emplacements.map((e) => (
            <button
              key={e.id}
              className="dashboard-picker-card"
              onClick={() => choisirEmplacement(e.id)}
              style={{ aspectRatio: "auto" }}
            >
              <div className="dashboard-picker-logo">📍</div>
              <div className="dashboard-picker-nom">{e.nom}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Pointage</h2>
      <p className="panel-hint">Entre ton NIP pour enregistrer ton arrivée ou ton départ.</p>

      <div className="pointage-kiosk">
        {showSuccess ? (
          <div className="pointage-success">
            <div ref={lottieRef} className="pointage-lottie"></div>
            {message && <p className="settings-msg ok">{message.text}</p>}
          </div>
        ) : (
          <>
            <div className="pointage-dots">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`pointage-dot${nip.length > i ? " filled" : ""}`}></span>
              ))}
            </div>

            {message && (
              <p className={`settings-msg ${message.type}`} style={{ textAlign: "center" }}>
                {message.text}
              </p>
            )}

            <div className="pointage-keypad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} className="pointage-key" onClick={() => pressDigit(d)} disabled={busy}>
                  {d}
                </button>
              ))}
              <button className="pointage-key" onClick={pressClear} disabled={busy}>
                Effacer
              </button>
              <button className="pointage-key" onClick={() => pressDigit("0")} disabled={busy}>
                0
              </button>
              <button className="pointage-key confirm" onClick={handleConfirm} disabled={busy || nip.length !== 4}>
                ✓
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
