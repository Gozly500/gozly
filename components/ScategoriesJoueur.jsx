"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/LangProvider";
import { genererId, normaliserCode, ouvrirSalle } from "@/lib/scategoriesRoom";
import { formatTemps } from "@/lib/scategories";

// Écran d'un joueur (téléphone) : il entre le code de la partie et son nom, puis répond aux catégories.
export default function ScategoriesJoueur({ codeInitial = "", onQuitter }) {
  const { t } = useT();
  const [code, setCode] = useState(normaliserCode(codeInitial));
  const [nom, setNom] = useState("");
  const [etape, setEtape] = useState("rejoindre"); // rejoindre | connexion | partie | fin
  const [erreur, setErreur] = useState("");
  const [etatHote, setEtatHote] = useState(null);
  const [resultats, setResultats] = useState(null);
  const [reponses, setReponses] = useState([]);
  const [restantLocal, setRestantLocal] = useState(0);

  const salleRef = useRef(null);
  const idRef = useRef(genererId());
  const nomRef = useRef("");
  const finLocaleRef = useRef(0);
  const mancheRef = useRef(0);
  const reponsesRef = useRef([]);
  const etatRef = useRef(null);
  const recuRef = useRef(false);
  const dernierEnvoiRef = useRef("");

  const envoyerReponses = useCallback((force) => {
    const salle = salleRef.current;
    if (!salle) return;
    const contenu = JSON.stringify(reponsesRef.current);
    if (!force && contenu === dernierEnvoiRef.current) return;
    dernierEnvoiRef.current = contenu;
    try {
      salle.envoyer({ t: "rep", id: idRef.current, nom: nomRef.current, manche: mancheRef.current, reponses: reponsesRef.current });
    } catch {}
  }, []);

  const quitter = useCallback(() => {
    try {
      salleRef.current?.quitter();
    } catch {}
    salleRef.current = null;
  }, []);

  useEffect(() => () => quitter(), [quitter]);

  function surMessage(m) {
    if (m.t === "etat") {
      recuRef.current = true;
      etatRef.current = m;
      setEtatHote(m);
      const vide = (m.categories || []).map(() => "");
      if (m.manche !== mancheRef.current) {
        // nouvelle manche : on repart de zéro
        mancheRef.current = m.manche;
        setResultats(null);
        dernierEnvoiRef.current = "";
        reponsesRef.current = vide;
        setReponses(vide);
      } else if (reponsesRef.current.length !== vide.length) {
        reponsesRef.current = vide;
        setReponses(vide);
      }
      if (m.phase === "jeu") finLocaleRef.current = Date.now() + (m.restant || 0) * 1000;
      if (m.phase === "pause") setRestantLocal(m.restant || 0);
      if (m.phase === "collecte") envoyerReponses(true);
    } else if (m.t === "resultats") {
      setResultats(m);
    } else if (m.t === "fin") {
      quitter();
      setEtape("fin");
    }
  }

  async function rejoindre(e) {
    e.preventDefault();
    setErreur("");
    const c = normaliserCode(code);
    const n = nom.trim().slice(0, 20);
    if (c.length !== 4) return setErreur(t("scat.codeInvalide"));
    if (!n) return setErreur(t("scat.nomRequis"));
    nomRef.current = n;
    recuRef.current = false;
    setEtape("connexion");
    try {
      const salle = await ouvrirSalle(c, { id: idRef.current, nom: n, role: "joueur" });
      salleRef.current = salle;
      salle.surMessage(surMessage);
      setCode(c);
      // Pas de message de l'hôte au bout de quelques secondes : le code ne correspond à aucune partie.
      setTimeout(() => {
        if (!recuRef.current && salleRef.current) {
          quitter();
          setEtape("rejoindre");
          setErreur(t("scat.partieIntrouvable"));
        }
      }, 6000);
      setEtape("partie");
    } catch {
      setEtape("rejoindre");
      setErreur(t("scat.erreurConnexion"));
    }
  }

  const phase = etatHote?.phase;

  // Compte à rebours local (resynchronisé par chaque message de l'hôte) + envoi régulier des réponses.
  useEffect(() => {
    if (etape !== "partie" || phase !== "jeu") return;
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((finLocaleRef.current - Date.now()) / 1000));
      setRestantLocal(r);
      if (r <= 0) envoyerReponses(true);
    }, 250);
    const brouillon = setInterval(() => envoyerReponses(false), 3000);
    return () => {
      clearInterval(id);
      clearInterval(brouillon);
    };
  }, [etape, phase, envoyerReponses]);

  function saisir(i, valeur) {
    const copie = [...reponsesRef.current];
    copie[i] = valeur.slice(0, 40);
    reponsesRef.current = copie;
    setReponses(copie);
  }

  function quitterPartie() {
    quitter();
    onQuitter?.();
  }

  const verrouille = phase !== "jeu" || restantLocal <= 0;
  const moi = resultats?.lignes?.find((l) => l.id === idRef.current);
  const rang = resultats?.classement ? resultats.classement.findIndex((c) => c.id === idRef.current) + 1 : 0;

  if (etape === "rejoindre" || etape === "connexion") {
    return (
      <div className="scat-j">
        <form className="scat-carte scat-j-form" onSubmit={rejoindre}>
          <h2>{t("scat.rejoindre")}</h2>
          <label>
            {t("scat.codeLabel")}
            <input className="scat-j-code" value={code} onChange={(e) => setCode(normaliserCode(e.target.value))} placeholder="ABCD" autoCapitalize="characters" autoComplete="off" inputMode="text" maxLength={4} />
          </label>
          <label>
            {t("scat.votreNom")}
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t("scat.votreNomPh")} maxLength={20} autoComplete="nickname" />
          </label>
          {erreur && <p className="scat-erreur">{erreur}</p>}
          <div className="scat-controles">
            <button type="submit" className="scat-btn scat-btn-go" disabled={etape === "connexion"}>
              {etape === "connexion" ? t("scat.connexion") : t("scat.rejoindreBtn")}
            </button>
            <button type="button" className="scat-btn" onClick={onQuitter}>
              {t("scat.retour")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (etape === "fin") {
    return (
      <div className="scat-j">
        <section className="scat-carte scat-j-carte">
          <h2>{t("scat.partieTerminee")}</h2>
          {resultats?.classement && (
            <ol className="scat-classement">
              {resultats.classement.map((c) => (
                <li key={c.id} className={c.id === idRef.current ? "moi" : ""}>
                  <span>{c.nom}</span>
                  <strong>{c.total}</strong>
                </li>
              ))}
            </ol>
          )}
          <button type="button" className="scat-btn" onClick={onQuitter}>
            {t("scat.retour")}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="scat-j">
      <section className="scat-carte scat-j-carte">
        <div className="scat-carte-tete">
          <h2>
            {t("scat.partie")} {code}
          </h2>
          <button type="button" className="scat-btn scat-btn-discret" onClick={quitterPartie}>
            {t("scat.quitter")}
          </button>
        </div>
        <p className="scat-sous">
          {nom}
          {etatHote ? ` · ${t("scat.manche").replace("{n}", etatHote.manche)}` : ""}
        </p>

        {!etatHote && <p className="scat-sous">{t("scat.connexion")}</p>}

        {etatHote && phase === "lobby" && <p className="scat-j-attente">{t("scat.attenteHote")}</p>}

        {etatHote && (phase === "jeu" || phase === "pause") && (
          <>
            <div className="scat-j-haut">
              <div className="scat-lettre scat-j-lettre">{etatHote.lettre}</div>
              <div className={`scat-j-temps${phase === "jeu" && restantLocal <= 10 ? " urgence" : ""}`}>{phase === "pause" ? t("scat.pause") : formatTemps(restantLocal)}</div>
            </div>
            <ol className="scat-j-champs">
              {etatHote.categories.map((c, i) => (
                <li key={`${i}-${c}`}>
                  <label>
                    <span className="scat-j-cat">
                      <span className="scat-num">{i + 1}</span> {c}
                    </span>
                    <input
                      value={reponses[i] || ""}
                      onChange={(e) => saisir(i, e.target.value)}
                      disabled={verrouille}
                      placeholder={`${etatHote.lettre}…`}
                      autoComplete="off"
                      autoCorrect="off"
                      enterKeyHint={i === etatHote.categories.length - 1 ? "done" : "next"}
                    />
                  </label>
                </li>
              ))}
            </ol>
          </>
        )}

        {etatHote && phase === "collecte" && <p className="scat-j-attente">{t("scat.envoiReponses")}</p>}

        {etatHote && phase === "resultats" && !resultats && <p className="scat-j-attente">{t("scat.collecte")}</p>}

        {etatHote && phase === "resultats" && resultats && (
          <>
            <h3 className="scat-joueurs-titre">
              {t("scat.resultats")} · {resultats.lettre}
            </h3>
            {moi ? (
              <>
                <ul className="scat-j-res">
                  {resultats.categories.map((c, i) => {
                    const cell = moi.cellules[i];
                    return (
                      <li key={`${i}-${c}`} className={cell.ok ? "ok" : cell.doublon ? "doublon" : "ko"}>
                        <span>{c}</span>
                        <span>
                          {cell.texte || "—"}
                          {cell.doublon && !cell.corrige ? ` · ${t("scat.doublon")}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="scat-j-total">
                  {t("scat.points")} : <strong>{moi.points}</strong>
                  {rang > 0 ? ` · ${t("scat.rang").replace("{n}", rang)}` : ""}
                </p>
              </>
            ) : (
              <p className="scat-sous">{t("scat.pasDansManche")}</p>
            )}
            <h3 className="scat-joueurs-titre">{t("scat.classement")}</h3>
            <ol className="scat-classement">
              {resultats.classement.map((c) => (
                <li key={c.id} className={c.id === idRef.current ? "moi" : ""}>
                  <span>{c.nom}</span>
                  <strong>{c.total}</strong>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
