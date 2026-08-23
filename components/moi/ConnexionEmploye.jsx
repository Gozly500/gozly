"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { employeFetch, setEmployeToken } from "@/lib/employeAuth";
import InstallerApp from "@/components/moi/InstallerApp";

export default function ConnexionEmploye() {
  const router = useRouter();
  const [etape, setEtape] = useState("code"); // "code" | "nip"
  const [codeAcces, setCodeAcces] = useState("");
  const [nip, setNip] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  function handleSubmitCode(e) {
    e.preventDefault();
    if (codeAcces.trim().length < 4) return;
    setMessage(null);
    setEtape("nip");
  }

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
    if (nip.length !== 4) return;
    setBusy(true);
    setMessage(null);

    try {
      const res = await employeFetch("/api/employe-app/connexion", {
        method: "POST",
        body: JSON.stringify({ codeAcces, nip }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Connexion impossible." });
        setNip("");
        setBusy(false);
        return;
      }

      setEmployeToken(data.token);
      router.push("/moi/horaire");
    } catch {
      setMessage({ type: "err", text: "Connexion impossible." });
      setNip("");
      setBusy(false);
    }
  }

  if (etape === "code") {
    return (
      <div className="moi-connexion">
        <h1>Gozly Équipe</h1>
        <p className="panel-hint">Entre le code d'entreprise fourni par ton employeur.</p>
        <form onSubmit={handleSubmitCode}>
          <div className="field">
            <label>Code d'entreprise</label>
            <input
              type="text"
              value={codeAcces}
              onChange={(e) => setCodeAcces(e.target.value.toUpperCase())}
              placeholder="Ex: A3F9K2"
              maxLength={6}
              autoFocus
              required
            />
          </div>
          <button type="submit" className="submit-btn" style={{ width: "100%" }}>
            Continuer
          </button>
        </form>
        <InstallerApp />
      </div>
    );
  }

  return (
    <div className="moi-connexion">
      <h1>Ton NIP</h1>
      <p className="panel-hint">Le même NIP que pour pointer au travail.</p>

      <div className="pointage-kiosk">
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
      </div>

      <button type="button" className="admin-icon-btn" onClick={() => setEtape("code")} style={{ marginTop: "18px" }}>
        ‹ Changer de code d'entreprise
      </button>
    </div>
  );
}
