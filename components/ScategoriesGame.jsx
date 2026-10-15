"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/LangProvider";
import { ALPHABET, LETTRES_DIFFICILES, DUREES, CLE_STOCKAGE, PRESETS, presetCategories, formatTemps } from "@/lib/scategories";
import { useSalleHote } from "@/lib/useSalleHote";

// Jeu Scategories (refait pour gozly.net) : une lettre, des catégories, un compte à rebours.
// Mode solo par défaut ; "Multijoueur" ouvre une salle (code) où les joueurs répondent depuis leur téléphone.
// Les réglages s'enregistrent sur l'appareil (localStorage) : pas besoin de compte.
export default function ScategoriesGame() {
  const { t, lang } = useT();
  const zoneRef = useRef(null);
  const audioRef = useRef(null);
  const finRef = useRef(0);
  const snapshotRef = useRef({});
  const courantRef = useRef({});

  const [lettre, setLettre] = useState("?");
  const [utilisees, setUtilisees] = useState([]);
  const [facile, setFacile] = useState(true);
  const [duree, setDuree] = useState(180);
  const [restant, setRestant] = useState(180);
  const [etat, setEtat] = useState("idle"); // idle | running | paused | ended
  const [manche, setManche] = useState(1);
  const [presetId, setPresetId] = useState("classique");
  const [categories, setCategories] = useState(() => presetCategories("classique", "fr"));
  const [personnalise, setPersonnalise] = useState(false);
  const [nouvelle, setNouvelle] = useState("");
  const [message, setMessage] = useState("");
  const [pleinEcran, setPleinEcran] = useState(false);
  const [popup, setPopup] = useState(false);

  const salle = useSalleHote(snapshotRef);
  const salleRef = useRef(salle);
  salleRef.current = salle;

  const phase = etat === "running" ? "jeu" : etat === "paused" ? "pause" : etat === "ended" ? (salle.resultat ? "resultats" : "collecte") : "lobby";
  snapshotRef.current = { phase, lettre, categories, restant: etat === "running" || etat === "paused" ? restant : null, manche, duree };
  courantRef.current = { manche, lettre, categories };

  // Les préréglages suivent la langue tant que la liste n'a pas été modifiée à la main.
  useEffect(() => {
    if (!personnalise) setCategories(presetCategories(presetId, lang));
  }, [lang, presetId, personnalise]);

  // Multijoueur : on prévient les joueurs à chaque changement d'état.
  useEffect(() => {
    if (salle.actif) salle.diffuser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lettre, manche, categories, salle.actif, salle.resultat]);

  const terminer = useCallback(() => {
    setRestant(0);
    setEtat("ended");
    sonner();
    if (salleRef.current.actif) {
      const c = courantRef.current;
      salleRef.current.lancerCollecte(c.manche, c.lettre, c.categories);
    }
  }, []);

  // Compte à rebours basé sur l'heure de fin (reste juste même si l'onglet ralentit).
  useEffect(() => {
    if (etat !== "running") return;
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((finRef.current - Date.now()) / 1000));
      setRestant(r);
      if (r <= 0) terminer();
    }, 200);
    return () => clearInterval(id);
  }, [etat, terminer]);

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
    setPopup(true);
  }

  function pause() {
    setEtat("paused");
  }

  function reprendre() {
    preparerSon();
    finRef.current = Date.now() + restant * 1000;
    setEtat("running");
  }

  // Solo : on remet le chrono à zéro. Multijoueur : on termine la manche tout de suite (récupération des réponses).
  function arreter() {
    if (salle.actif && (etat === "running" || etat === "paused")) return terminer();
    setEtat("idle");
    setRestant(duree);
  }

  function terminerDepuisPopup() {
    if (salle.actif) return terminer();
    setEtat("idle");
    setRestant(duree);
    setPopup(false);
  }

  function mancheSuivante() {
    setPopup(false);
    salle.nouvelleManche();
    setManche((m) => m + 1);
    setEtat("idle");
    setLettre("?");
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

  function terminerPartie() {
    setPopup(false);
    salle.quitter();
    setEtat("idle");
    setLettre("?");
    setRestant(duree);
    setManche(1);
  }

  const affiche = etat === "idle" ? duree : restant;
  const fraction = etat === "idle" ? 1 : duree > 0 ? restant / duree : 0;
  const urgence = etat === "running" && restant <= 10;
  const R = 54;
  const circ = 2 * Math.PI * R;
  const res = salle.resultat;
  const popupOuvert = popup && (etat === "running" || etat === "paused" || (etat === "ended" && (!salle.actif || !res)));
  const lien = typeof window !== "undefined" && salle.code ? `${window.location.origin}/scategories/jouer?code=${salle.code}` : "";

  return (
    <div ref={zoneRef} className={`scat-zone${pleinEcran ? " scat-plein" : ""}`}>
      <div className="scat-grille">
        <div className="scat-gauche">
          {salle.actif && (
            <section className="scat-carte scat-salle">
              <div className="scat-carte-tete">
                <h2>{t("scat.salleTitre")}</h2>
                <button type="button" className="scat-btn scat-btn-discret" onClick={terminerPartie}>
                  {t("scat.terminerPartie")}
                </button>
              </div>
              {salle.statut === "connexion" && <p className="scat-sous">{t("scat.connexion")}</p>}
              {salle.statut === "erreur" && <p className="scat-erreur">{t("scat.erreurConnexion")}</p>}
              {salle.statut === "ok" && (
                <>
                  <p className="scat-sous">{t("scat.codeLabel")}</p>
                  <div className="scat-code" aria-label={t("scat.codeLabel")}>
                    {salle.code}
                  </div>
                  <p className="scat-sous">
                    {t("scat.rejoindreSur")} <strong>{lien}</strong>
                  </p>
                  <h3 className="scat-joueurs-titre">
                    {t("scat.joueurs")} ({salle.joueurs.length})
                  </h3>
                  {salle.joueurs.length === 0 ? (
                    <p className="scat-sous">{t("scat.aucunJoueur")}</p>
                  ) : (
                    <ul className="scat-joueurs">
                      {salle.joueurs.map((j) => (
                        <li key={j.id}>{j.nom}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          )}

          <section className="scat-carte">
            <div className="scat-carte-tete">
              <h2>
                {t("scat.partie")}
                {salle.actif ? ` · ${t("scat.manche").replace("{n}", manche)}` : ""}
              </h2>
              <div className="scat-tete-actions">
                {!salle.actif && (
                  <button type="button" className="scat-btn scat-btn-discret" onClick={salle.creer}>
                    {t("scat.multi")}
                  </button>
                )}
                <button type="button" className="scat-btn scat-btn-discret" onClick={basculerPleinEcran}>
                  {pleinEcran ? t("scat.quitterPlein") : t("scat.plein")}
                </button>
              </div>
            </div>

            <div className="scat-partie">
              <div key={lettre} className={`scat-lettre${lettre === "?" ? " vide" : ""}`} aria-label={t("scat.lettre")}>
                {lettre}
              </div>
              <div className={`scat-chrono${urgence ? " urgence" : ""}${etat === "ended" ? " fini" : ""}`}>
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle cx="60" cy="60" r={R} className="scat-anneau-fond" />
                  <circle cx="60" cy="60" r={R} className="scat-anneau" strokeDasharray={circ} strokeDashoffset={circ * (1 - fraction)} transform="rotate(-90 60 60)" />
                </svg>
                <span className="scat-temps">{etat === "ended" ? "0:00" : formatTemps(affiche)}</span>
              </div>
            </div>

            {etat === "ended" && <p className="scat-fin">{salle.actif && !res ? t("scat.collecte") : t("scat.tempsEcoule")}</p>}

            <div className="scat-controles">
              <select value={duree} onChange={(e) => changerDuree(e.target.value)} disabled={etat === "running" || etat === "paused"} aria-label={t("scat.temps")} className="scat-select">
                {DUREES.map((d) => (
                  <option key={d} value={d}>
                    {t("scat.minutes").replace("{n}", d / 60)}
                  </option>
                ))}
              </select>
              <button type="button" className="scat-btn" onClick={tirerLettre} disabled={etat === "running" || etat === "ended"}>
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
              ) : etat === "ended" ? (
                salle.actif ? (
                  <button type="button" className="scat-btn scat-btn-go" onClick={mancheSuivante} disabled={!res}>
                    {t("scat.mancheSuivante")}
                  </button>
                ) : (
                  <button type="button" className="scat-btn scat-btn-go" onClick={arreter}>
                    {t("scat.rejouer")}
                  </button>
                )
              ) : (
                <button type="button" className="scat-btn scat-btn-go" onClick={demarrer}>
                  {t("scat.demarrer")}
                </button>
              )}
              {(etat === "running" || etat === "paused") && (
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

          {res && (
            <section className="scat-carte scat-resultats">
              <div className="scat-carte-tete">
                <h2>
                  {t("scat.resultats")} · {t("scat.manche").replace("{n}", res.manche)} · {res.lettre}
                </h2>
              </div>
              {res.lignes.length === 0 ? (
                <p className="scat-sous">{t("scat.aucunJoueur")}</p>
              ) : (
                <>
                  <p className="scat-sous">{t("scat.clicBascule")}</p>
                  <div className="scat-tableau-wrap">
                    <table className="scat-tableau">
                      <thead>
                        <tr>
                          <th>{t("scat.categories")}</th>
                          {res.lignes.map((l) => (
                            <th key={l.id}>{l.nom}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {res.categories.map((c, i) => (
                          <tr key={`${i}-${c}`}>
                            <td>{c}</td>
                            {res.lignes.map((l) => {
                              const cell = l.cellules[i];
                              return (
                                <td key={l.id}>
                                  <button type="button" className={`scat-cell ${cell.ok ? "ok" : cell.doublon ? "doublon" : "ko"}`} onClick={() => salle.corriger(l.id, i)} title={cell.doublon ? t("scat.doublon") : ""}>
                                    {cell.texte || "—"}
                                    {cell.doublon && !cell.corrige ? <small> · {t("scat.doublon")}</small> : null}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>{t("scat.points")}</td>
                          {res.lignes.map((l) => (
                            <td key={l.id}>
                              <strong>{l.points}</strong>
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <h3 className="scat-joueurs-titre">{t("scat.classement")}</h3>
                  <ol className="scat-classement">
                    {salle.classement.map((c) => (
                      <li key={c.id}>
                        <span>{c.nom}</span>
                        <strong>{c.total}</strong>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>
          )}

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
            <a className="scat-btn scat-lien-btn" href="/scategories/carte-de-jeu.pdf" target="_blank" rel="noopener">
              {t("scat.carteLien")}
            </a>
          </div>
          <p className="scat-message" aria-live="polite">
            {message}
          </p>
        </aside>
      </div>

      {popupOuvert && (
        <div className="scat-popup" role="dialog" aria-modal="true">
          <div className="scat-popup-grille">
            <section className="scat-popup-carte scat-popup-temps">
              <div key={lettre} className="scat-lettre scat-popup-lettre" aria-label={t("scat.lettre")}>
                {lettre}
              </div>
              <div className={`scat-chrono scat-popup-chrono${urgence ? " urgence" : ""}${etat === "ended" ? " fini" : ""}`}>
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle cx="60" cy="60" r={R} className="scat-anneau-fond" />
                  <circle cx="60" cy="60" r={R} className="scat-anneau" strokeDasharray={circ} strokeDashoffset={circ * (1 - fraction)} transform="rotate(-90 60 60)" />
                </svg>
                <span className="scat-temps">{etat === "ended" ? "0:00" : formatTemps(affiche)}</span>
              </div>
              {etat === "ended" && <p className="scat-fin">{salle.actif && !res ? t("scat.collecte") : t("scat.tempsEcoule")}</p>}
              {salle.actif && salle.joueurs.length > 0 && (
                <p className="scat-sous">
                  {t("scat.joueurs")} : {salle.joueurs.length}
                </p>
              )}
              <div className="scat-popup-actions">
                {etat === "running" && (
                  <button type="button" className="scat-btn scat-btn-go" onClick={pause}>
                    {t("scat.pause")}
                  </button>
                )}
                {etat === "paused" && (
                  <>
                    <button type="button" className="scat-btn scat-btn-go" onClick={reprendre}>
                      {t("scat.reprendre")}
                    </button>
                    <button type="button" className="scat-btn scat-btn-stop" onClick={terminerDepuisPopup}>
                      {t("scat.terminer")}
                    </button>
                  </>
                )}
                {etat === "ended" && !salle.actif && (
                  <button type="button" className="scat-btn" onClick={() => setPopup(false)}>
                    {t("scat.fermer")}
                  </button>
                )}
              </div>
            </section>

            <section className="scat-popup-carte scat-popup-cats">
              <h2>{t("scat.categories")}</h2>
              <ol>
                {categories.map((c, i) => (
                  <li key={`${i}-${c}`}>
                    <span className="scat-num">{i + 1}</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
