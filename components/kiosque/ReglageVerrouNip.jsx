"use client";

import { useEffect, useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";
import { NIP_MAX, NIP_MIN, definirNip, effacerVerrouNip, modifierReglageAuto, nipDefini, nipValide, reglageVerrou, surChangementVerrou, verifierNip, verrouiller } from "@/lib/verrouNip";

// Réglages du kiosque : NIP de la tablette (gardé sur la tablette, marche sans connexion) et verrouillage automatique.
export default function ReglageVerrouNip() {
  const { t } = useLangue();
  const [defini, setDefini] = useState(false);
  const [reglage, setReglage] = useState(null);
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState(null); // { ok, texte }
  const [ouvert, setOuvert] = useState(false); // formulaire de changement visible

  useEffect(() => {
    const relire = () => {
      setDefini(nipDefini());
      setReglage(reglageVerrou());
    };
    relire();
    return surChangementVerrou(relire);
  }, []);

  const chiffres = (v) => v.replace(/\D/g, "").slice(0, NIP_MAX);

  async function enregistrer() {
    setMessage(null);
    if (defini && !(await verifierNip(actuel))) return setMessage({ ok: false, texte: t("kq.nip.r.actuelFaux") });
    if (!nipValide(nouveau)) return setMessage({ ok: false, texte: t("kq.nip.r.longueur", { min: NIP_MIN, max: NIP_MAX }) });
    if (nouveau !== confirmation) return setMessage({ ok: false, texte: t("kq.nip.r.different") });
    await definirNip(nouveau);
    setActuel("");
    setNouveau("");
    setConfirmation("");
    setOuvert(false);
    setMessage({ ok: true, texte: t("kq.nip.r.enregistre") });
  }

  async function retirer() {
    setMessage(null);
    if (!(await verifierNip(actuel))) return setMessage({ ok: false, texte: t("kq.nip.r.actuelFaux") });
    effacerVerrouNip();
    setActuel("");
    setOuvert(false);
    setMessage({ ok: true, texte: t("kq.nip.r.retire") });
  }

  const champ = (valeur, onChange, etiquette) => (
    <label style={{ display: "block", marginBottom: "8px" }}>
      <span className="panel-hint" style={{ display: "block", marginBottom: "2px" }}>{etiquette}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={valeur}
        onChange={(e) => onChange(chiffres(e.target.value))}
        style={{ width: "160px", letterSpacing: "6px", textAlign: "center" }}
      />
    </label>
  );

  const AUTO = [
    { id: "jamais", label: t("kq.nip.auto.jamais") },
    { id: "fermeture", label: t("kq.nip.auto.fermeture") },
    { id: "heure", label: t("kq.nip.auto.heure") },
  ];

  return (
    <div style={{ marginBottom: "22px" }}>
      <h3 style={{ marginBottom: "4px" }}>{t("kq.nip.r.titre")}</h3>
      <p className="panel-hint">{t("kq.nip.r.desc")}</p>

      {!defini || ouvert ? (
        <div style={{ marginBottom: "10px" }}>
          {defini && champ(actuel, setActuel, t("kq.nip.r.actuel"))}
          {champ(nouveau, setNouveau, t("kq.nip.r.nouveau", { min: NIP_MIN, max: NIP_MAX }))}
          {champ(confirmation, setConfirmation, t("kq.nip.r.confirmer"))}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="submit-btn" onClick={enregistrer}>
              {defini ? t("kq.nip.r.changer") : t("kq.nip.r.definir")}
            </button>
            {defini && (
              <>
                <button type="button" className="admin-icon-btn danger" onClick={retirer}>{t("kq.nip.r.retirerBtn")}</button>
                <button type="button" className="admin-icon-btn" onClick={() => { setOuvert(false); setMessage(null); }}>{t("kq.nip.annuler")}</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
          <button type="button" className="submit-btn" onClick={verrouiller}>{t("kq.nip.verrouiller")}</button>
          <button type="button" className="admin-icon-btn" onClick={() => setOuvert(true)}>{t("kq.nip.r.modifier")}</button>
        </div>
      )}

      {message && <p style={{ color: message.ok ? "#7ee2a8" : "#ff9494", margin: "6px 0" }}>{message.texte}</p>}

      {defini && reglage && !ouvert && (
        <>
          <h4 style={{ margin: "14px 0 4px" }}>{t("kq.nip.auto.titre")}</h4>
          <p className="panel-hint">{t("kq.nip.auto.desc")}</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {AUTO.map((a) => (
              <button
                key={a.id}
                type="button"
                className="admin-icon-btn"
                style={reglage.auto === a.id ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
                aria-pressed={reglage.auto === a.id}
                onClick={() => modifierReglageAuto({ auto: a.id })}
              >
                {a.label}
              </button>
            ))}
            {reglage.auto === "heure" && (
              <input type="time" value={reglage.heure} onChange={(e) => e.target.value && modifierReglageAuto({ heure: e.target.value })} />
            )}
          </div>
          {reglage.auto === "fermeture" && <p className="panel-hint" style={{ marginTop: "6px" }}>{t("kq.nip.auto.fermetureAide")}</p>}
        </>
      )}
    </div>
  );
}
