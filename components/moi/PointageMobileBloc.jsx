"use client";

import { useEffect, useRef, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import EmplacementSelect from "@/components/EmplacementSelect";
import { useLangue } from "@/components/moi/LangueContext";
import { localeDate } from "@/lib/i18n/moi";

function formatHeure(iso, langue) {
  return new Date(iso).toLocaleTimeString(localeDate(langue), { hour: "2-digit", minute: "2-digit" });
}

// forcer : affiche le bloc même sans quart aujourd'hui (bouton "Pointer" de l'horaire) ;
// onTermine : appelé quand l'animation de succès est finie.
export default function PointageMobileBloc({ forcer = false, onTermine } = {}) {
  const { t, langue } = useLangue();
  const [etat, setEtat] = useState(null);
  const [emplacementChoisi, setEmplacementChoisi] = useState(null);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);
  const lottieRef = useRef(null);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    const res = await employeFetch("/api/employe-app/pointage-mobile");
    if (!res.ok) return;
    const data = await res.json();
    setEtat(data);
    if (data?.pointageOuvert?.emplacementId) {
      setEmplacementChoisi(data.pointageOuvert.emplacementId);
    } else if (data?.emplacements?.length >= 1) {
      setEmplacementChoisi(data.emplacements[0].id);
    }
  }

  useEffect(() => {
    if (!succes || !lottieRef.current) return;

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
    });

    const minuteur = setTimeout(() => {
      setSucces(null);
      charger();
      onTermine?.();
    }, 4000);

    return () => {
      cancelled = true;
      anim?.destroy();
      clearTimeout(minuteur);
    };
  }, [succes]);

  function confirmerPointage() {
    setConfirmationOuverte(false);
    setErreur(null);
    setBusy(true);

    if (!navigator.geolocation) {
      setErreur(t("pointage.localisationIndisponible"));
      setBusy(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await employeFetch("/api/employe-app/pointage-mobile", {
            method: "POST",
            body: JSON.stringify({
              emplacementId: emplacementChoisi,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setErreur(data.error || t("pointage.erreur"));
            setBusy(false);
            return;
          }
          setBusy(false);
          setSucces(data);
        } catch {
          setErreur(t("pointage.erreurReessaie"));
          setBusy(false);
        }
      },
      () => {
        setErreur(t("pointage.localisationRefusee"));
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (!etat || !etat.actif) return null;

  const enPoste = !!etat.pointageOuvert;
  if (enPoste && !etat.pointageOuvert.gpsDisponible) return null;
  if (!enPoste && ((!forcer && !etat.aQuartAujourdhui) || etat.emplacements.length === 0)) return null;

  const nomChoisi = enPoste
    ? etat.pointageOuvert.emplacementNom
    : etat.emplacements.find((e) => e.id === emplacementChoisi)?.nom;

  if (succes) {
    return (
      <div className="pointage-mobile-bloc pointage-success">
        <div ref={lottieRef} className="pointage-lottie"></div>
        <p className="settings-msg ok">
          {t("pointage.succesLigne", {
            action: succes.type === "arrivee" ? t("pointage.shiftDebute") : t("pointage.shiftTermine"),
            heure: formatHeure(succes.heure, langue),
            lieu: succes.emplacementNom,
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="pointage-mobile-bloc">
      <h3>{t("pointage.titre")}</h3>

      {enPoste ? (
        <p className="panel-hint">
          {t("pointage.enPosteDepuis", { heure: formatHeure(etat.pointageOuvert.entree, langue), lieu: etat.pointageOuvert.emplacementNom })}
        </p>
      ) : (
        <>
          <p className="panel-hint">{t("pointage.pret")}</p>
          <EmplacementSelect emplacements={etat.emplacements} value={emplacementChoisi} onChange={setEmplacementChoisi} />
        </>
      )}

      {erreur && <p className="settings-msg err">{erreur}</p>}

      <button
        type="button"
        className="btn-small"
        onClick={() => setConfirmationOuverte(true)}
        disabled={busy || !emplacementChoisi}
      >
        {busy ? t("pointage.instant") : enPoste ? t("pointage.terminer") : t("pointage.debuter")}
      </button>

      {confirmationOuverte && (
        <div className="modal-overlay" onClick={() => setConfirmationOuverte(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("pointage.confirmerTitre")}</h3>
            </div>
            <p>{t(enPoste ? "pointage.confirmerFin" : "pointage.confirmerDebut", { lieu: nomChoisi })}</p>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button type="button" className="admin-icon-btn" onClick={() => setConfirmationOuverte(false)}>
                {t("pointage.annuler")}
              </button>
              <button type="button" className="btn-small" onClick={confirmerPointage}>
                {t("pointage.confirmer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
