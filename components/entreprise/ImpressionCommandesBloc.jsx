"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { xmlVersLignes } from "@/lib/apercuBon";

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

// Configuration de l'imprimante Epson (Personnalisation > Commandes en
// ligne) : active l'impression, donne l'URL à coller dans la config de
// l'imprimante et permet d'envoyer un bon de test.
// selecteur : le menu « Impression des commandes manuelles », affiché à côté des boutons.
export default function ImpressionCommandesBloc({ entrepriseId, selecteur }) {
  const [etat, setEtat] = useState(null); // { actif, url }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [copie, setCopie] = useState(false);
  const [apercu, setApercu] = useState(null); // { exemple, derniere } : XML des bons
  const [apercuSource, setApercuSource] = useState("exemple");
  const [apercuOuvert, setApercuOuvert] = useState(false);

  async function voirApercu() {
    setMsg(null);
    const r = await appelerImpression(entrepriseId, "apercu");
    if (!r.ok || !r.exemple) {
      setMsg({ type: "err", text: r.error || "Impossible d'afficher l'aperçu." });
      return;
    }
    setApercu({ exemple: r.exemple, derniere: r.derniere || null });
    setApercuSource("exemple");
    setApercuOuvert(true);
  }

  useEffect(() => {
    appelerImpression(entrepriseId, "etat").then((r) => setEtat({ actif: !!r.actif, url: r.url || null }));
  }, [entrepriseId]);

  async function lancer(action, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true);
    setMsg(null);
    const r = await appelerImpression(entrepriseId, action);
    setBusy(false);
    if (!r.ok) {
      setMsg({ type: "err", text: `${r.error || "L'action a échoué."}${r.detail ? ` [${r.detail}]` : ""}` });
      return;
    }
    if (action === "tester") {
      setMsg({ type: "ok", text: "Bon de test envoyé. Il devrait sortir de l'imprimante dans quelques secondes." });
      return;
    }
    setEtat({ actif: !!r.actif, url: r.url || null });
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(etat.url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {}
  }

  if (!etat) return <p className="section-hint">Chargement...</p>;

  return (
    <div className="param-subgroup">
      <div className="param-subgroup-label">Impression des bons de commande (Epson)</div>

      <div className="impression-ligne">
        {selecteur && <div className="impression-selecteur">{selecteur}</div>}
        <div className="impression-boutons">
          <button className="admin-icon-btn" disabled={busy} onClick={voirApercu}>
            👁 Aperçu du bon
          </button>
          {!etat.actif ? (
            <button className="submit-btn" disabled={busy} onClick={() => lancer("activer")}>
              Activer l&apos;impression
            </button>
          ) : (
            <>
              <button className="submit-btn" disabled={busy} onClick={() => lancer("tester")}>
                Imprimer un bon de test
              </button>
              <button
                className="admin-icon-btn"
                disabled={busy}
                onClick={() =>
                  lancer("regenerer", "Générer une nouvelle adresse? L'ancienne cessera de fonctionner : tu devras la remplacer dans l'imprimante.")
                }
              >
                Nouvelle adresse
              </button>
              <button
                className="admin-icon-btn danger"
                disabled={busy}
                onClick={() => lancer("desactiver", "Désactiver l'impression? Les bons en attente seront annulés.")}
              >
                Désactiver
              </button>
            </>
          )}
        </div>
      </div>

      {etat.actif && (
        <>
          <p className="section-hint">
            Impression activée. Dans la configuration de l&apos;imprimante (Epson Web Config : tape l&apos;adresse IP de l&apos;imprimante dans un
            navigateur), va dans <strong>Server Direct Print</strong>, active-le, et entre cette adresse comme URL du serveur 1. Mets l&apos;intervalle
            à 5 secondes. Laisse l&apos;ID et le mot de passe vides.
          </p>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
            <input type="text" readOnly value={etat.url || ""} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: "260px" }} />
            <button className="admin-icon-btn" onClick={copier}>
              {copie ? "Copié ✓" : "Copier"}
            </button>
          </div>
          <p className="section-hint">Garde cette adresse privée : quiconque la connaît peut interroger ton imprimante.</p>
        </>
      )}

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {apercuOuvert && apercu && (
        <div className="modal-overlay" onClick={() => setApercuOuvert(false)}>
          <div className="modal-card" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Aperçu du bon de commande</h3>
              <button className="admin-icon-btn" onClick={() => setApercuOuvert(false)}>
                Fermer
              </button>
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button
                className="admin-icon-btn"
                style={apercuSource === "exemple" ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
                onClick={() => setApercuSource("exemple")}
              >
                Exemple
              </button>
              {apercu.derniere && (
                <button
                  className="admin-icon-btn"
                  style={apercuSource === "derniere" ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
                  onClick={() => setApercuSource("derniere")}
                >
                  Ma dernière commande
                </button>
              )}
            </div>
            <div className="bon-papier">
              {xmlVersLignes(apercuSource === "derniere" && apercu.derniere ? apercu.derniere : apercu.exemple).map((l, i) =>
                l.coupe ? (
                  <div key={i} className="bon-coupe">
                    ✂ - - - - - - - - - - - - - - - - - -
                  </div>
                ) : (
                  <div
                    key={i}
                    style={{ textAlign: l.align, fontWeight: l.gras ? 700 : 400, fontSize: l.grand ? "2em" : "1em", lineHeight: l.grand ? 1.15 : 1.3 }}
                  >
                    {l.texte || "\u00A0"}
                  </div>
                )
              )}
            </div>
            <p className="section-hint" style={{ marginTop: "10px" }}>
              C&apos;est le contenu exact envoyé à l&apos;imprimante. Les accents sont retirés à l&apos;impression (l&apos;imprimante les afficherait mal).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
