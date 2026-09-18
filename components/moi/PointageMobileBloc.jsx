"use client";

import { useEffect, useRef, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import EmplacementSelect from "@/components/EmplacementSelect";

function formatHeure(iso) {
  return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

export default function PointageMobileBloc() {
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
    console.log("[DEBUG pointage mobile]", data);
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
      setErreur("La localisation n'est pas disponible sur cet appareil.");
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
            setErreur(data.error || "Le pointage a échoué.");
            setBusy(false);
            return;
          }
          setBusy(false);
          setSucces(data);
        } catch {
          setErreur("Le pointage a échoué. Réessaie.");
          setBusy(false);
        }
      },
      () => {
        setErreur("On n'a pas pu confirmer ta position. Active la localisation et réessaie.");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (!etat || !etat.actif) return null;

  const enPoste = !!etat.pointageOuvert;
  if (enPoste && !etat.pointageOuvert.gpsDisponible) return null;
  if (!enPoste && (!etat.aQuartAujourdhui || etat.emplacements.length === 0)) return null;

  const nomChoisi = enPoste
    ? etat.pointageOuvert.emplacementNom
    : etat.emplacements.find((e) => e.id === emplacementChoisi)?.nom;

  if (succes) {
    return (
      <div className="pointage-mobile-bloc pointage-success">
        <div ref={lottieRef} className="pointage-lottie"></div>
        <p className="settings-msg ok">
          {succes.type === "arrivee" ? "Shift débuté" : "Shift terminé"} à {formatHeure(succes.heure)} —{" "}
          {succes.emplacementNom}
        </p>
      </div>
    );
  }

  return (
    <div className="pointage-mobile-bloc">
      <h3>Pointage</h3>

      {enPoste ? (
        <p className="panel-hint">
          En poste depuis {formatHeure(etat.pointageOuvert.entree)} — {etat.pointageOuvert.emplacementNom}
        </p>
      ) : (
        <>
          <p className="panel-hint">Prêt à débuter ton shift ?</p>
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
        {busy ? "Un instant..." : enPoste ? "Terminer mon shift" : "Débuter mon shift"}
      </button>

      {confirmationOuverte && (
        <div className="modal-overlay" onClick={() => setConfirmationOuverte(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Confirmer</h3>
            </div>
            <p>
              {enPoste ? `Terminer ton shift à ${nomChoisi} ?` : `Débuter ton shift à ${nomChoisi} ?`}
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button type="button" className="admin-icon-btn" onClick={() => setConfirmationOuverte(false)}>
                Annuler
              </button>
              <button type="button" className="btn-small" onClick={confirmerPointage}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
