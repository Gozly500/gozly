"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/LangProvider";
import { ALPHABET, LETTRES_DIFFICILES, DUREES, CLE_STOCKAGE, PRESETS, presetCategories, formatTemps } from "@/lib/scategories";

// Jeu Scategories (refait pour gozly.net) : une lettre, des catégories, un compte à rebours.
// Les réglages s'enregistrent sur l'appareil (localStorage) : pas besoin de compte.
export default function ScategoriesGame() {
  const { t, lang } = useT();
  const zoneRef = useRef(null);
  const audioRef = useRef(null);
  const finRef = useRef(0);

  const [lettre, setLettre] = useState("?");
  const [utilisees, setUtilisees] = useState([]);
  const [facile, setFacile] = useState(true);
  const [duree, setDuree] = useState(180);
  const [restant, setRestant] = useState(180);
  const [etat, setEtat] = useState("idle"); // idle | running | paused | ended
  const [presetId, setPresetId] = useState("classique");
  const [categories, setCategories] = useState(() => presetCategories("classique", "fr"));
  const [personnalise, setPersonnalise] = useState(false);
  const [nouvelle, setNouvelle] = useState("");
  const [message, setMessage] = useState("");
  const [pleinEcran, setPleinEcran] = useState(false);

  // Les préréglages suivent la langue tant que la liste n'a pas été modifiée à la main.
  useEffect(() => {
    if (!personnalise) setCategories(presetCategories(presetId, lang));
  }, [lang, presetId, personnalise]);

  // Compte à rebours basé sur l'heure de fin (reste juste même si l'onglet ralentit).
  useEffect(() => {
    if (etat !== "running") return;
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((finRef.current - Date.now()) / 1000));
      setRestant(r);
      if (r <= 0) {
        setEtat("ended");
        sonner();
      }
    }, 200);
    return () => clearInterval(id);
  }, [etat]);

  useEffect(() => {
    const surChangement = () => setPleinEcran(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", surChangement);
    return () => document.removeEventListener("fullscreenchange", surChangement);
  }, []);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(""), 2500);
    return () => clearTimeout(id);
  }, [message]);

  function preparerSon() {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioRef.current.state === "suspended") audioRef.current.resume();
    } catch {}
  }

  // Alarme : 3 bips générés (aucun fichier audio à charger).
  function sonner() {
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      [0, 0.4, 0.8].forEach((delai) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = 880;
        g.gain.value = 0.12;
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime + delai);
        o.stop(ctx.currentTime + delai + 0.25);
      });
    } catch {}
  }

  const tirerLettre = useCallback(() => {
    const permises = ALPHABET.filter((l) => !(facile && LETTRES_DIFFICILES.includes(l)));
    let restantes = permises.filter((l) => !utilisees.includes(l));
    let deja = utilisees;
    if (restantes.length === 0) {
      restantes = permises;
      deja = [];
    }
    const choisie = restantes[Math.floor(Math.random() * restantes.length)];
    setLettre(choisie);
    setUtilisees([...deja, choisie]);
    return choisie;
  }, [facile, utilisees]);

  function demarrer() {
    preparerSon();
    if (lettre === "?") tirerLettre();
    finRef.current = Date.now() + duree * 1000;
    setRestant(duree);
    setEtat("running");
  }

  function pause() {
    setEtat("paused");
  }

  function reprendre() {
    preparerSon();
    finRef.current = Date.now() + restant * 1000;
    setEtat("running");
  }

  function arreter() {
    setEtat("idle");
    setRestant(duree);
  }

  function changerDuree(v) {
    const n = Number(v);
    setDuree(n);
    if (etat === "idle") setRestant(n);
  }

  function choisirPreset(id) {
    setPresetId(id);
    setPersonnalise(false);
    setCategories(presetCategories(id, lang));
  }

  function modifier(liste) {
    setCategories(liste);
    setPersonnalise(true);
  }

  function ajouter(e) {
    e.preventDefault();
    const nom = nouvelle.trim();
    if (!nom || categories.length >= 20) return;
    modifier([...categories, nom]);
    setNouvelle("");
  }

  function melanger() {
    const copie = [...categories];
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    modifier(copie);
  }

  function reinitialiser() {
    setEtat("idle");
    setLettre("?");
    setUtilisees([]);
    setRestant(duree);
    setPresetId("classique");
    setPersonnalise(false);
    setCategories(presetCategories("classique", lang));
  }

  function enregistrer() {
    try {
      window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify({ categories, duree, facile }));
      setMessage(t("scat.sauve"));
    } catch {}
  }

  function charger() {
    try {
      const brut = window.localStorage.getItem(CLE_STOCKAGE);
      if (!brut) return setMessage(t("scat.aucunSauve"));
      const s = JSON.parse(brut);
      if (Array.isArray(s.categories) && s.categories.length) {
        setCategories(s.categories.slice(0, 20).map(String));
        setPersonnalise(true);
      }
      if (DUREES.includes(s.duree)) {
        setDuree(s.duree);
        if (etat === "idle") setRestant(s.duree);
      }
      if (typeof s.facile === "boolean") setFacile(s.facile);
      setMessage(t("scat.charge"));
    } catch {
      setMessage(t("scat.aucunSauve"));
    }
  }

  function basculerPleinEcran() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else zoneRef.current?.requestFullscreen?.();
  }

  const affiche = etat === "idle" ? duree : restant;
  const fraction = etat === "idle" ? 1 : duree > 0 ? restant / duree : 0;
  const urgence = etat === "running" && restant <= 10;
  const R = 54;
  const circ = 2 * Math.PI * R;

  return (
    <>
      <div ref={zoneRef} className={`scat-zone${pleinEcran ? " scat-plein" : ""}`}>
        <div className="scat-grille">
          <div className="scat-gauche">
            <section className="scat-carte">
              <div className="scat-carte-tete">
                <h2>{t("scat.partie")}</h2>
                <button type="button" className="scat-btn scat-btn-discret" onClick={basculerPleinEcran}>
                  {pleinEcran ? t("scat.quitterPlein") : t("scat.plein")}
                </button>
              </div>

              <div className="scat-partie">
                <div key={lettre} className={`scat-lettre${lettre === "?" ? " vide" : ""}`} aria-label={t("scat.lettre")}>
                  {lettre}
                </div>
                <div className={`scat-chrono${urgence ? " urgence" : ""}${etat === "ended" ? " fini" : ""}`}>
                  <svg viewBox="0 0 120 120" aria-hidden="true">
                    <circle cx="60" cy="60" r={R} className="scat-anneau-fond" />
                    <circle
                      cx="60"
                      cy="60"
                      r={R}
                      className="scat-anneau"
                      strokeDasharray={circ}
                      strokeDashoffset={circ * (1 - fraction)}
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <span className="scat-temps">{etat === "ended" ? "0:00" : formatTemps(affiche)}</span>
                </div>
              </div>

              {etat === "ended" && <p className="scat-fin">{t("scat.tempsEcoule")}</p>}

              <div className="scat-controles">
                <select value={duree} onChange={(e) => changerDuree(e.target.value)} disabled={etat === "running" || etat === "paused"} aria-label={t("scat.temps")} className="scat-select">
                  {DUREES.map((d) => (
                    <option key={d} value={d}>
                      {t("scat.minutes").replace("{n}", d / 60)}
                    </option>
                  ))}
                </select>
                <button type="button" className="scat-btn" onClick={tirerLettre} disabled={etat === "running"}>
                  {t("scat.lettreAlea")}
                </button>
                {etat === "running" ? (
                  <button type="button" className="scat-btn scat-btn-go" onClick={pause}>
                    {t("scat.pause")}
                  </button>
                ) : etat === "paused" ? (
                  <button type="button" className="scat-btn scat-btn-go" onClick={reprendre}>
                    {t("scat.reprendre")}
                  </button>
                ) : (
                  <button type="button" className="scat-btn scat-btn-go" onClick={demarrer}>
                    {t("scat.demarrer")}
                  </button>
                )}
                {etat !== "idle" && (
                  <button type="button" className="scat-btn" onClick={arreter}>
                    {t("scat.arreter")}
                  </button>
                )}
              </div>

              <label className="scat-case">
                <input type="checkbox" checked={facile} onChange={(e) => setFacile(e.target.checked)} />
                <span>{t("scat.facile")}</span>
              </label>

              {utilisees.length > 0 && (
                <p className="scat-utilisees">
                  {t("scat.utilisees")} : <strong>{utilisees.join(" ")}</strong>
                </p>
              )}
            </section>

            <section className="scat-carte">
              <div className="scat-carte-tete">
                <h2>{t("scat.categories")}</h2>
                <button type="button" className="scat-btn scat-btn-discret" onClick={melanger}>
                  {t("scat.melanger")}
                </button>
              </div>
              <ol className="scat-liste">
                {categories.map((c, i) => (
                  <li key={`${i}-${c}`} className="scat-categorie">
                    <span className="scat-num">{i + 1}</span>
                    <span className="scat-nom">{c}</span>
                    <button type="button" className="scat-retirer" aria-label={t("scat.retirer")} title={t("scat.retirer")} onClick={() => modifier(categories.filter((_, k) => k !== i))}>
                      ×
                    </button>
                  </li>
                ))}
              </ol>
              <form className="scat-ajout" onSubmit={ajouter}>
                <input type="text" value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} placeholder={t("scat.ajouterPh")} maxLength={40} />
                <button type="submit" className="scat-btn" disabled={!nouvelle.trim() || categories.length >= 20}>
                  {t("scat.ajouter")}
                </button>
              </form>
            </section>
          </div>

          <aside className="scat-carte scat-droite">
            <h2>{t("scat.prereglages")}</h2>
            <div className="scat-presets">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className={`scat-preset${!personnalise && presetId === p.id ? " actif" : ""}`} onClick={() => choisirPreset(p.id)}>
                  {t("scat.preset." + p.id)}
                </button>
              ))}
            </div>
            <hr />
            <div className="scat-actions">
              <button type="button" className="scat-btn" onClick={reinitialiser}>
                {t("scat.reset")}
              </button>
              <button type="button" className="scat-btn" onClick={enregistrer}>
                {t("scat.enregistrer")}
              </button>
              <button type="button" className="scat-btn" onClick={charger}>
                {t("scat.charger")}
              </button>
              <button type="button" className="scat-btn" onClick={() => window.print()}>
                {t("scat.imprimer")}
              </button>
            </div>
            <p className="scat-message" aria-live="polite">
              {message}
            </p>
          </aside>
        </div>
      </div>

      {/* Carte de jeu imprimable (visible seulement à l'impression) */}
      <div className="scat-print">
        <h1>Scategories — {t("scat.carteTitre")}</h1>
        <table>
          <thead>
            <tr>
              <th>{t("scat.categories")}</th>
              {[1, 2, 3].map((n) => (
                <th key={n}>{t("scat.manche").replace("{n}", n)}</th>
              ))}
            </tr>
            <tr>
              <th>{t("scat.lettre")}</th>
              {[1, 2, 3].map((n) => (
                <th key={n} />
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={`${i}-${c}`}>
                <td>
                  {i + 1}. {c}
                </td>
                {[1, 2, 3].map((n) => (
                  <td key={n} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
