"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ETIQUETTES_STATUT } from "@/lib/appsDeveloppeur";
import { categorieDe } from "@/lib/integrationsCatalogue";

export default function AppsDeveloppeurSection() {
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [erreur, setErreur] = useState("");
  const [ouverte, setOuverte] = useState(null);
  const [refus, setRefus] = useState(null); // { app, message }

  async function appeler(methode, corps) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/apps-developpeur", {
      method: methode,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Erreur.");
    return data;
  }

  async function charger() {
    setLoading(true);
    setErreur("");
    try {
      const data = await appeler("GET");
      setApps(data.apps || []);
    } catch (e) {
      setErreur(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    charger();
  }, []);

  async function decider(a, statut, note = "") {
    try {
      await appeler("POST", { id: a.id, statut, note });
      setRefus(null);
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <div>
      <h2>Apps développeur</h2>
      {erreur && <p className="settings-msg err">{erreur}</p>}
      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : apps.length === 0 && !erreur ? (
        <p className="panel-hint">Aucune app soumise.</p>
      ) : (
        <div className="admin-list" style={{ maxWidth: "760px" }}>
          {apps.map((a) => (
            <div key={a.id}>
              <div className="admin-row" style={{ cursor: "pointer" }} onClick={() => setOuverte(ouverte === a.id ? null : a.id)}>
                <div className="admin-row-main">
                  <div className="admin-row-title">{a.nom}</div>
                  <div className="admin-row-sub">
                    {a.proprietaire_id ? `Par ${a.developpeur}` : "Sans propriétaire"} · {ETIQUETTES_STATUT[a.statut]}
                  </div>
                </div>
                <div className="admin-row-controls" onClick={(e) => e.stopPropagation()}>
                  <button className="admin-icon-btn" onClick={() => setOuverte(ouverte === a.id ? null : a.id)}>
                    {ouverte === a.id ? "Masquer" : "Détails"}
                  </button>
                  {a.statut !== "approuvee" && (
                    <button className="admin-icon-btn" onClick={() => decider(a, "approuvee")}>
                      Approuver
                    </button>
                  )}
                  <button
                    className="admin-icon-btn danger"
                    onClick={async () => {
                      if (!window.confirm("Supprimer cette app? Les entreprises qui l'ont installée la perdront.")) return;
                      try {
                        await appeler("POST", { id: a.id, supprimer: true });
                        charger();
                      } catch (e) {
                        setErreur(e.message);
                      }
                    }}
                  >
                    Supprimer
                  </button>
                  {a.statut !== "refusee" && (
                    <button className="admin-icon-btn danger" onClick={() => setRefus({ app: a, message: "" })}>
                      Refuser
                    </button>
                  )}
                </div>
              </div>
              {ouverte === a.id && (
                <div style={{ padding: "8px 16px 18px", fontSize: "13.5px", display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {a.icone ? <img src={a.icone} alt="" width={56} height={56} style={{ borderRadius: "12px" }} /> : null}
                    <div>
                      <strong style={{ fontSize: "15px" }}>{a.nom}</strong>
                      <div style={{ color: "var(--text-dim)" }}>{categorieDe(a.categorie)?.label || a.categorie}</div>
                    </div>
                  </div>
                  <Ligne titre="Description courte">{a.description_courte}</Ligne>
                  {a.description_longue && <Ligne titre="Description longue"><span style={{ whiteSpace: "pre-wrap" }}>{a.description_longue}</span></Ligne>}
                  <Ligne titre="Adresse du service"><Lien url={a.url_service} /></Ligne>
                  <Ligne titre="Retour de connexion"><Lien url={a.url_retour} /></Ligne>
                  <Ligne titre="Permissions">{a.permissions?.length ? a.permissions.join(", ") : "Aucune"}</Ligne>
                  <Ligne titre="Courriel de support">{a.courriel_support}</Ligne>
                  <Ligne titre="Confidentialité"><Lien url={a.url_confidentialite} /></Ligne>
                  <Ligne titre="Prix">{a.payant ? a.prix : "Gratuit"}</Ligne>
                  {a.note_refus && <Ligne titre="Raison du refus">{a.note_refus}</Ligne>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {refus && (
        <div className="modal-overlay" onClick={() => setRefus(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Refuser {refus.app.nom}</h3>
            </div>
            <p className="panel-hint" style={{ marginTop: 0 }}>Ce message sera visible par le développeur.</p>
            <textarea
              rows={5}
              style={{ width: "100%" }}
              value={refus.message}
              onChange={(e) => setRefus({ ...refus, message: e.target.value })}
              maxLength={500}
              autoFocus
            />
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
              <button type="button" className="submit-btn" disabled={!refus.message.trim()} onClick={() => decider(refus.app, "refusee", refus.message.trim())}>
                Refuser l'app
              </button>
              <button type="button" className="admin-icon-btn" onClick={() => setRefus(null)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Ligne({ titre, children }) {
  return (
    <div>
      <div style={{ color: "var(--text-dim)", fontSize: "12px" }}>{titre}</div>
      <div>{children}</div>
    </div>
  );
}

function Lien({ url }) {
  // Une fiche vient d'un tiers : seuls les liens https:// deviennent cliquables.
  if (!String(url || "").toLowerCase().startsWith("https://")) return <span>{url}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", wordBreak: "break-all" }}>
      {url}
    </a>
  );
}
