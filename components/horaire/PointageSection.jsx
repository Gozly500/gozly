"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PointageSection({ entrepriseId }) {
  const [nip, setNip] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

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

    const { data: dernier } = await supabase
      .from("pointages")
      .select("type")
      .eq("employe_id", employe.id)
      .order("horodatage", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prochainType = dernier?.type === "arrivee" ? "depart" : "arrivee";

    await supabase.from("pointages").insert({
      entreprise_id: entrepriseId,
      employe_id: employe.id,
      type: prochainType,
    });

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
  }

  return (
    <div>
      <h2>Pointage</h2>
      <p className="panel-hint">Entre ton NIP pour enregistrer ton arrivée ou ton départ.</p>

      <div className="pointage-kiosk">
        <div className="pointage-dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pointage-dot${nip.length > i ? " filled" : ""}`}></span>
          ))}
        </div>

        {message && <p className={`settings-msg ${message.type}`} style={{ textAlign: "center" }}>{message.text}</p>}

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
          <button
            className="pointage-key confirm"
            onClick={handleConfirm}
            disabled={busy || nip.length !== 4}
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  );
}
