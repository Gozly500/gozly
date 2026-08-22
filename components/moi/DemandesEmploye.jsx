"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { getDebutSemaine } from "@/lib/semaine";

function badgeConge(statut) {
  if (statut === "approuve") return "✅ Approuvé";
  if (statut === "refuse") return "❌ Refusé";
  return "⏳ En attente";
}

function badgeEchange(d) {
  if (d.statutEmploye === "refuse") return "❌ Refusé";
  if (d.statutEmploye === "en_attente") return d.role === "receveur" ? "À répondre" : "⏳ En attente de réponse";
  if (d.statutAdmin === "approuve" || d.statutAdmin === "non_requis") return "✅ Approuvé";
  if (d.statutAdmin === "refuse") return "❌ Refusé par l'admin";
  return "⏳ En attente d'approbation";
}

export default function DemandesEmploye() {
  const [onglet, setOnglet] = useState("conges"); // "conges" | "echanges"
  const [conges, setConges] = useState([]);
  const [echanges, setEchanges] = useState([]);
  const [collegues, setCollegues] = useState([]);
  const [mesQuarts, setMesQuarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const [formCongeOpen, setFormCongeOpen] = useState(false);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [raison, setRaison] = useState("");

  const [formEchangeOpen, setFormEchangeOpen] = useState(false);
  const [quartChoisi, setQuartChoisi] = useState("");
  const [collegueChoisi, setCollegueChoisi] = useState("");

  useEffect(() => {
    chargerTout();
  }, []);

  async function chargerTout() {
    setLoading(true);
    const semaine = getDebutSemaine(new Date()).toISOString().slice(0, 10);
    const [congesRes, echangesRes, colleguesRes, quartsRes] = await Promise.all([
      employeFetch("/api/employe-app/demandes/conges"),
      employeFetch("/api/employe-app/demandes/echanges"),
      employeFetch("/api/employe-app/chat/collegues"),
      employeFetch(`/api/employe-app/horaire?semaine=${semaine}`),
    ]);
    setConges((await congesRes.json()).demandes || []);
    setEchanges((await echangesRes.json()).demandes || []);
    setCollegues((await colleguesRes.json()).collegues || []);
    setMesQuarts((await quartsRes.json()).quarts || []);
    setLoading(false);
  }

  async function handleSubmitConge(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await employeFetch("/api/employe-app/demandes/conges", {
      method: "POST",
      body: JSON.stringify({ dateDebut, dateFin, raison }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ type: "err", text: data.error || "La demande a échoué." });
      return;
    }
    setDateDebut("");
    setDateFin("");
    setRaison("");
    setFormCongeOpen(false);
    chargerTout();
  }

  async function handleSubmitEchange(e) {
    e.preventDefault();
    if (!quartChoisi || !collegueChoisi) return;
    setBusy(true);
    setMsg(null);
    const res = await employeFetch("/api/employe-app/demandes/echanges", {
      method: "POST",
      body: JSON.stringify({ quartId: quartChoisi, avecEmployeId: collegueChoisi }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ type: "err", text: data.error || "La demande a échoué." });
      return;
    }
    setQuartChoisi("");
    setCollegueChoisi("");
    setFormEchangeOpen(false);
    chargerTout();
  }

  async function repondreEchange(id, accepte) {
    setBusy(true);
    setMsg(null);
    const res = await employeFetch(`/api/employe-app/demandes/echanges/${id}/repondre`, {
      method: "POST",
      body: JSON.stringify({ accepte }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ type: "err", text: data.error || "Impossible de répondre." });
      return;
    }
    chargerTout();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <div className="settings-nav" style={{ flexDirection: "row", marginBottom: "18px", width: "fit-content" }}>
        <button type="button" className={`settings-nav-item${onglet === "conges" ? " active" : ""}`} onClick={() => setOnglet("conges")}>
          Congés
        </button>
        <button type="button" className={`settings-nav-item${onglet === "echanges" ? " active" : ""}`} onClick={() => setOnglet("echanges")}>
          Échanges
        </button>
      </div>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {onglet === "conges" && (
        <div>
          <button type="button" className="submit-btn" onClick={() => setFormCongeOpen((v) => !v)} style={{ marginBottom: "14px" }}>
            + Demander un congé
          </button>

          {formCongeOpen && (
            <form onSubmit={handleSubmitConge} style={{ marginBottom: "18px" }}>
              <div className="field-row">
                <div className="field">
                  <label>Date de début</label>
                  <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Date de fin</label>
                  <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required />
                </div>
              </div>
              <div className="field">
                <label>Raison (optionnel)</label>
                <input type="text" value={raison} onChange={(e) => setRaison(e.target.value)} placeholder="Ex: vacances" />
              </div>
              <button type="submit" className="submit-btn" disabled={busy}>
                {busy ? "Envoi..." : "Envoyer la demande"}
              </button>
            </form>
          )}

          {conges.length === 0 ? (
            <p className="chat-empty">Aucune demande de congé.</p>
          ) : (
            <div className="admin-list">
              {conges.map((c) => (
                <div className="admin-row" key={c.id}>
                  <div className="admin-row-main">
                    <div className="admin-row-title">
                      Du {new Date(c.date_debut).toLocaleDateString("fr-CA")} au {new Date(c.date_fin).toLocaleDateString("fr-CA")}
                    </div>
                    <div className="admin-row-sub">
                      {badgeConge(c.statut)}
                      {c.raison && ` · ${c.raison}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {onglet === "echanges" && (
        <div>
          <button type="button" className="submit-btn" onClick={() => setFormEchangeOpen((v) => !v)} style={{ marginBottom: "14px" }}>
            + Proposer un échange
          </button>

          {formEchangeOpen && (
            <form onSubmit={handleSubmitEchange} style={{ marginBottom: "18px" }}>
              <div className="field">
                <label>Quel quart ?</label>
                <select value={quartChoisi} onChange={(e) => setQuartChoisi(e.target.value)} required>
                  <option value="">Choisir un quart cette semaine...</option>
                  {mesQuarts.map((q) => (
                    <option key={q.id} value={q.id}>
                      {new Date(q.date).toLocaleDateString("fr-CA")} · {q.heure_debut.slice(0, 5)}–{q.heure_fin.slice(0, 5)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>À qui ?</label>
                <select value={collegueChoisi} onChange={(e) => setCollegueChoisi(e.target.value)} required>
                  <option value="">Choisir un collègue...</option>
                  {collegues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="submit-btn" disabled={busy || mesQuarts.length === 0}>
                {busy ? "Envoi..." : "Proposer"}
              </button>
              {mesQuarts.length === 0 && <p className="section-hint">Tu n'as aucun quart cette semaine.</p>}
            </form>
          )}

          {echanges.length === 0 ? (
            <p className="chat-empty">Aucun échange.</p>
          ) : (
            <div className="admin-list">
              {echanges.map((d) => (
                <div className="admin-row" key={d.id}>
                  <div className="admin-row-main">
                    <div className="admin-row-title">
                      {d.role === "donneur" ? `Toi → ${d.autreNom}` : `${d.autreNom} → Toi`}
                    </div>
                    <div className="admin-row-sub">
                      {d.quart && (
                        <>
                          {new Date(d.quart.date).toLocaleDateString("fr-CA")} · {d.quart.heure_debut?.slice(0, 5)}–
                          {d.quart.heure_fin?.slice(0, 5)} ·{" "}
                        </>
                      )}
                      {badgeEchange(d)}
                    </div>
                  </div>
                  {d.role === "receveur" && d.statutEmploye === "en_attente" && (
                    <div className="admin-row-controls">
                      <button className="admin-icon-btn" onClick={() => repondreEchange(d.id, true)} disabled={busy}>
                        Accepter
                      </button>
                      <button className="admin-icon-btn danger" onClick={() => repondreEchange(d.id, false)} disabled={busy}>
                        Refuser
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
