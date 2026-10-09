"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import RappelNotifications from "@/components/moi/RappelNotifications";
import { useLangue } from "@/components/moi/LangueContext";
import { localeDate } from "@/lib/i18n/moi";
import { dansLeQuart } from "@/lib/echangeQuart";
import Pictos from "@/components/icons/Pictos";

function badgeConge(statut, t) {
  if (statut === "approuve") return t("demandes.approuve");
  if (statut === "refuse") return t("demandes.refuse");
  return t("demandes.enAttente");
}

export function badgeEchange(d, t) {
  if (d.statutEmploye === "refuse") return t("demandes.refuse");
  if (d.statutEmploye === "en_attente") return d.role === "receveur" ? t("demandes.aRepondre") : t("demandes.attenteReponse");
  if (d.statutAdmin === "approuve" || d.statutAdmin === "non_requis") return t("demandes.approuve");
  if (d.statutAdmin === "refuse") return t("demandes.refuseParAdmin");
  return t("demandes.attenteApprobation");
}

export default function DemandesEmploye() {
  const { t, langue } = useLangue();
  const [onglet, setOnglet] = useState("conges"); // "conges" | "echanges"
  const [conges, setConges] = useState([]);
  const [echanges, setEchanges] = useState([]);
  const [collegues, setCollegues] = useState([]);
  const [mesQuarts, setMesQuarts] = useState([]);
  const [congesActif, setCongesActif] = useState(true);
  const [echangesActif, setEchangesActif] = useState(true);
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
  const [heureDebutEch, setHeureDebutEch] = useState("");
  const [heureFinEch, setHeureFinEch] = useState("");

  useEffect(() => {
    chargerTout();
  }, []);

  async function chargerTout() {
    setLoading(true);
    const [moiRes, congesRes, echangesRes, colleguesRes, quartsRes] = await Promise.all([
      employeFetch("/api/employe-app/moi"),
      employeFetch("/api/employe-app/demandes/conges"),
      employeFetch("/api/employe-app/demandes/echanges"),
      employeFetch("/api/employe-app/chat/collegues"),
      employeFetch("/api/employe-app/demandes/mes-quarts"),
    ]);
    const moi = await moiRes.json();
    const congesEstActif = moi.entreprise?.congesActif !== false;
    const echangesEstActif = moi.entreprise?.echangesActif !== false;
    setCongesActif(congesEstActif);
    setEchangesActif(echangesEstActif);
    setOnglet((cur) => (cur === "conges" && !congesEstActif && echangesEstActif ? "echanges" : cur === "echanges" && !echangesEstActif && congesEstActif ? "conges" : cur));
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
      setMsg({ type: "err", text: data.error || t("demandes.erreur") });
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
      body: JSON.stringify({ quartId: quartChoisi, avecEmployeId: collegueChoisi, heureDebut: heureDebutEch, heureFin: heureFinEch }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ type: "err", text: data.error || t("demandes.erreur") });
      return;
    }
    setQuartChoisi("");
    setCollegueChoisi("");
    setHeureDebutEch("");
    setHeureFinEch("");
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
      setMsg({ type: "err", text: data.error || t("demandes.erreurReponse") });
      return;
    }
    chargerTout();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>{t("nav.chargement")}</p>;
  }

  if (!congesActif && !echangesActif) {
    return <p className="chat-empty">{t("demandes.desactiveLesDeux")}</p>;
  }

  return (
    <div>
      <div className="settings-nav" style={{ flexDirection: "row", marginBottom: "18px", width: "fit-content" }}>
        {congesActif && (
          <button type="button" className={`settings-nav-item${onglet === "conges" ? " active" : ""}`} onClick={() => setOnglet("conges")}>
            {t("demandes.tabConges")}
          </button>
        )}
        {echangesActif && (
          <button type="button" className={`settings-nav-item${onglet === "echanges" ? " active" : ""}`} onClick={() => setOnglet("echanges")}>
            {t("demandes.tabEchanges")}
          </button>
        )}
      </div>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {onglet === "conges" && congesActif && (
        <div>
          <button type="button" className="submit-btn" onClick={() => setFormCongeOpen((v) => !v)} style={{ marginBottom: "14px" }}>
            {t("demandes.ajouterConge")}
          </button>

          {formCongeOpen && (
            <form onSubmit={handleSubmitConge} style={{ marginBottom: "18px" }}>
              <div className="field-row">
                <div className="field">
                  <label>{t("demandes.dateDebut")}</label>
                  <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required />
                </div>
                <div className="field">
                  <label>{t("demandes.dateFin")}</label>
                  <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required />
                </div>
              </div>
              <div className="field">
                <label>{t("demandes.raison")}</label>
                <input type="text" value={raison} onChange={(e) => setRaison(e.target.value)} placeholder={t("demandes.raisonPlaceholder")} />
              </div>
              <button type="submit" className="submit-btn" disabled={busy}>
                {busy ? t("demandes.envoi") : t("demandes.envoyer")}
              </button>
            </form>
          )}

          {conges.length === 0 ? (
            <p className="chat-empty">{t("demandes.aucunConge")}</p>
          ) : (
            <div className="admin-list">
              {conges.map((c) => (
                <div className="admin-row" key={c.id}>
                  <div className="admin-row-main">
                    <div className="admin-row-title">
                      {t("demandes.duAu", {
                        debut: new Date(c.date_debut).toLocaleDateString(localeDate(langue)),
                        fin: new Date(c.date_fin).toLocaleDateString(localeDate(langue)),
                      })}
                    </div>
                    <div className="admin-row-sub">
                      <Pictos texte={badgeConge(c.statut, t)} />
                      {c.raison && ` · ${c.raison}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {onglet === "echanges" && echangesActif && (
        <div>
          <button type="button" className="submit-btn" onClick={() => setFormEchangeOpen((v) => !v)} style={{ marginBottom: "14px" }}>
            {t("demandes.ajouterEchange")}
          </button>

          {formEchangeOpen && (
            <form onSubmit={handleSubmitEchange} style={{ marginBottom: "18px" }}>
              <div className="field">
                <label>{t("demandes.quelQuart")}</label>
                <select
                  value={quartChoisi}
                  onChange={(e) => {
                    setQuartChoisi(e.target.value);
                    const q = mesQuarts.find((x) => x.id === e.target.value);
                    setHeureDebutEch(q ? q.heure_debut.slice(0, 5) : "");
                    setHeureFinEch(q ? q.heure_fin.slice(0, 5) : "");
                  }}
                  required
                >
                  <option value="">{t("demandes.choisirQuart")}</option>
                  {mesQuarts.map((q) => (
                    <option key={q.id} value={q.id}>
                      {new Date(q.date).toLocaleDateString(localeDate(langue))} · {q.heure_debut.slice(0, 5)}–{q.heure_fin.slice(0, 5)}
                    </option>
                  ))}
                </select>
              </div>
              {quartChoisi && (
                <div className="field">
                  <label>{t("demandes.heuresEchange")}</label>
                  <div className="field-row">
                    <input
                      type="time"
                      value={heureDebutEch}
                      min={mesQuarts.find((x) => x.id === quartChoisi)?.heure_debut.slice(0, 5)}
                      max={mesQuarts.find((x) => x.id === quartChoisi)?.heure_fin.slice(0, 5)}
                      onChange={(e) => setHeureDebutEch(e.target.value)}
                      onBlur={() => setHeureDebutEch((v) => dansLeQuart(v, mesQuarts.find((x) => x.id === quartChoisi)))}
                      required
                    />
                    <input
                      type="time"
                      value={heureFinEch}
                      min={mesQuarts.find((x) => x.id === quartChoisi)?.heure_debut.slice(0, 5)}
                      max={mesQuarts.find((x) => x.id === quartChoisi)?.heure_fin.slice(0, 5)}
                      onChange={(e) => setHeureFinEch(e.target.value)}
                      onBlur={() => setHeureFinEch((v) => dansLeQuart(v, mesQuarts.find((x) => x.id === quartChoisi)))}
                      required
                    />
                  </div>
                </div>
              )}
              <div className="field">
                <label>{t("demandes.aQui")}</label>
                <select value={collegueChoisi} onChange={(e) => setCollegueChoisi(e.target.value)} required>
                  <option value="">{t("demandes.choisirCollegue")}</option>
                  {collegues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="submit-btn" disabled={busy || mesQuarts.length === 0}>
                {busy ? t("demandes.envoi") : t("demandes.proposer")}
              </button>
              {mesQuarts.length === 0 && <p className="section-hint">{t("demandes.aucunQuartSemaine")}</p>}
            </form>
          )}

          {echanges.length === 0 ? (
            <p className="chat-empty">{t("demandes.aucunEchange")}</p>
          ) : (
            <div className="admin-list">
              {echanges.map((d) => (
                <div className="admin-row" key={d.id}>
                  <div className="admin-row-main">
                    <div className="admin-row-title">
                      {d.role === "donneur" ? t("demandes.toiVers", { nom: d.autreNom }) : t("demandes.versToi", { nom: d.autreNom })}
                    </div>
                    <div className="admin-row-sub">
                      {d.quart && (
                        <>
                          {new Date(d.quart.date).toLocaleDateString(localeDate(langue))} ·{" "}
                          {d.heureDebut && d.heureFin
                            ? `${d.heureDebut}–${d.heureFin} (${t("demandes.partieDuQuart", { debut: d.quart.heure_debut?.slice(0, 5), fin: d.quart.heure_fin?.slice(0, 5) })})`
                            : `${d.quart.heure_debut?.slice(0, 5)}–${d.quart.heure_fin?.slice(0, 5)}`}{" "}
                          ·{" "}
                        </>
                      )}
                      <Pictos texte={badgeEchange(d, t)} />
                    </div>
                  </div>
                  {d.role === "receveur" && d.statutEmploye === "en_attente" && (
                    <div className="admin-row-controls">
                      <button className="admin-icon-btn" onClick={() => repondreEchange(d.id, true)} disabled={busy}>
                        {t("demandes.accepter")}
                      </button>
                      <button className="admin-icon-btn danger" onClick={() => repondreEchange(d.id, false)} disabled={busy}>
                        {t("demandes.refuser")}
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
