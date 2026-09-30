"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { employeFetch, setEmployeToken } from "@/lib/employeAuth";
import InstallerApp from "@/components/moi/InstallerApp";
import { useLangue } from "@/components/moi/LangueContext";
import { CLE_ONBOARDING_VU_MOI } from "@/components/moi/OnboardingEmploye";

export default function ConnexionEmploye() {
  const router = useRouter();
  const { t } = useLangue();
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
        setMessage({ type: "err", text: data.error || t("login.erreur") });
        setNip("");
        setBusy(false);
        return;
      }

      setEmployeToken(data.token);

      let dejaVu = false;
      try {
        dejaVu = !!window.localStorage.getItem(CLE_ONBOARDING_VU_MOI);
      } catch {}
      router.push(dejaVu ? "/moi/accueil" : "/moi/bienvenue");
    } catch {
      setMessage({ type: "err", text: t("login.erreur") });
      setNip("");
      setBusy(false);
    }
  }

  if (etape === "code") {
    return (
      <div className="moi-connexion">
        <h1>Gozly Équipe</h1>
        <p className="panel-hint">{t("login.hintCode")}</p>
        <form onSubmit={handleSubmitCode}>
          <div className="field">
            <label>{t("login.labelCode")}</label>
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
            {t("login.continuer")}
          </button>
        </form>
        <InstallerApp />
      </div>
    );
  }

  return (
    <div className="moi-connexion">
      <h1>{t("login.titreNip")}</h1>
      <p className="panel-hint">{t("login.hintNip")}</p>

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
            {t("login.effacer")}
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
        {t("login.changerCode")}
      </button>
    </div>
  );
}
