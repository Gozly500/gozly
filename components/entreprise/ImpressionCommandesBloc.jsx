"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { xmlVersLignes } from "@/lib/apercuBon";
import { IconOeil } from "@/components/icons/Pictogrammes";
import InfoTooltip from "@/components/InfoTooltip";
import { useT } from "@/components/LangProvider";

async function appelerImpression(entrepriseId, action) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/commandes/impression", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token}` },
    body: JSON.stringify({ entrepriseId, action }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, ...json };
}

// Impression des bons de commande (Personnalisation > Commandes > Impression) : active l'impression (le kiosque Android
// imprime en Bluetooth), aperçu du bon et bon de test.
// selecteur : le menu « Impression des commandes manuelles », affiché à côté des boutons.
export default function ImpressionCommandesBloc({ entrepriseId, selecteur }) {
  const { t } = useT();
  const [etat, setEtat] = useState(null); // { actif }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [apercu, setApercu] = useState(null); // { exemple, derniere } : XML des bons
  const [apercuSource, setApercuSource] = useState("exemple");
  const [apercuOuvert, setApercuOuvert] = useState(false);

  async function voirApercu() {
    setMsg(null);
    const r = await appelerImpression(entrepriseId, "apercu");
    if (!r.ok || !r.exemple) {
      setMsg({ type: "err", text: r.error || t("Impossible d'afficher l'aperçu.") });
      return;
    }
    setApercu({ exemple: r.exemple, derniere: r.derniere || null });
    setApercuSource("exemple");
    setApercuOuvert(true);
  }

  useEffect(() => {
    appelerImpression(entrepriseId, "etat").then((r) => setEtat({ actif: !!r.actif }));
  }, [entrepriseId]);

  async function lancer(action, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true);
    setMsg(null);
    const r = await appelerImpression(entrepriseId, action);
    setBusy(false);
    if (!r.ok) {
      setMsg({ type: "err", text: `${r.error || t("L'action a échoué.")}${r.detail ? ` [${r.detail}]` : ""}` });
      return;
    }
    if (action === "tester") {
      setMsg({ type: "ok", text: t("Bon de test envoyé. Il devrait sortir de l'imprimante dans quelques secondes (le kiosque doit être ouvert).") });
      return;
    }
    setEtat({ actif: !!r.actif });
  }

  if (!etat) return <p className="section-hint">{t("Chargement...")}</p>;

  return (
    <div>
      {selecteur}

      <div className="param-ligne">
        <div className="param-ligne-libelle">
          {t("Impression des bons de commande")}
          <InfoTooltip>{t("Les bons sont imprimés par le kiosque Android, en Bluetooth : active l'impression ici, puis choisis l'imprimante dans les réglages du kiosque.")}</InfoTooltip>
        </div>
        <div className="impression-boutons">
          <button className="admin-icon-btn" disabled={busy} onClick={voirApercu}>
            <IconOeil className="gozly-icon" />{" "}{t("Aperçu du bon")}
          </button>
          {!etat.actif ? (
            <button className="submit-btn" disabled={busy} onClick={() => lancer("activer")}>
              {t("Activer l'impression")}
            </button>
          ) : (
            <>
              <button className="submit-btn" disabled={busy} onClick={() => lancer("tester")}>
                {t("Imprimer un bon de test")}
              </button>
              <button
                className="admin-icon-btn danger"
                disabled={busy}
                onClick={() => lancer("desactiver", t("Désactiver l'impression? Les bons en attente seront annulés."))}
              >
                {t("Désactiver")}
              </button>
            </>
          )}
        </div>
      </div>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {apercuOuvert && apercu && (
        <div className="modal-overlay" onClick={() => setApercuOuvert(false)}>
          <div className="modal-card" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("Aperçu du bon de commande")}</h3>
              <button className="admin-icon-btn" onClick={() => setApercuOuvert(false)}>
                {t("Fermer")}
              </button>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button
                className="admin-icon-btn"
                style={apercuSource === "exemple" ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
                onClick={() => setApercuSource("exemple")}
              >
                {t("Exemple")}
              </button>
              {apercu.derniere && (
                <button
                  className="admin-icon-btn"
                  style={apercuSource === "derniere" ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
                  onClick={() => setApercuSource("derniere")}
                >
                  {t("Ma dernière commande")}
                </button>
              )}
            </div>
            <div className="bon-papier">
              {xmlVersLignes(apercuSource === "derniere" && apercu.derniere ? apercu.derniere : apercu.exemple).map((l, i) =>
                l.coupe ? (
                  <div key={i} className="bon-coupe">
                    - - - - - - - - - - - - - - - - - - -
                  </div>
                ) : (
                  <div
                    key={i}
                    style={{
                      textAlign: l.align,
                      fontWeight: l.gras ? 700 : 400,
                      fontSize: l.grand ? "2em" : "1em",
                      lineHeight: l.grand ? 1.15 : 1.3,
                      ...(l.inverse ? { background: "#111", color: "#fff" } : null),
                    }}
                  >
                    {l.texte || "\u00A0"}
                  </div>
                )
              )}
            </div>
            <p className="section-hint" style={{ marginTop: "10px" }}>
              {t("C'est le contenu exact envoyé à l'imprimante. Les accents sont retirés à l'impression (l'imprimante les afficherait mal).")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
