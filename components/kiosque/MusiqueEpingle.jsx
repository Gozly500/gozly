"use client";

import { useEffect, useRef, useState } from "react";
import { sonosApi } from "@/lib/sonosClient";
import { ACTIONS_IMMEDIATES, appliquerDemo, etatDemo } from "@/lib/sonosDemo";
import { useLangue } from "@/components/moi/LangueContext";
import { IconMusique } from "@/components/icons/GozlyIcons";

const Svg = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    {children}
  </svg>
);
const Trait = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);
const Lecture = (p) => <Svg {...p}><path d="M8 5v14l11-7z" /></Svg>;
const Pause = (p) => <Svg {...p}><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></Svg>;
const Precedent = (p) => <Svg {...p}><path d="M6 5h2v14H6zM20 5v14L9 12z" /></Svg>;
const Suivant = (p) => <Svg {...p}><path d="M16 5h2v14h-2zM4 5l11 7-11 7z" /></Svg>;
const Agrandir = (p) => <Trait {...p}><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></Trait>;
const Reduire = (p) => <Trait {...p}><path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7" /></Trait>;
const Fermer = (p) => <Trait {...p}><path d="M6 6l12 12M18 6L6 18" /></Trait>;
const HautParleur = (p) => <Trait {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 010 7" /></Trait>;

// Curseur de volume : suit le doigt en local, n'envoie la valeur qu'au relâchement.
function Curseur({ valeur, onValider, label }) {
  const [local, setLocal] = useState(valeur ?? 0);
  const glisse = useRef(false);
  useEffect(() => {
    if (!glisse.current && valeur != null) setLocal(valeur);
  }, [valeur]);

  function valider(e) {
    if (!glisse.current) return;
    glisse.current = false;
    onValider(Number(e.currentTarget.value));
  }

  return (
    <input
      type="range"
      min="0"
      max="100"
      value={local}
      aria-label={label}
      disabled={valeur == null}
      className="gx-curseur"
      style={{ "--pct": `${local}%` }}
      onChange={(e) => {
        glisse.current = true;
        setLocal(Number(e.target.value));
      }}
      onPointerUp={valider}
      onKeyUp={valider}
      onBlur={valider}
    />
  );
}

// État Sonos de l'entreprise + envoi des commandes. En démo (demo = true) : faux haut-parleurs, rien n'est envoyé.
function useSonos({ entrepriseId, demo }) {
  const [etat, setEtat] = useState(demo ? etatDemo() : null);

  async function charger() {
    if (!entrepriseId || demo) return;
    const r = await sonosApi(`/api/sonos/etat?entrepriseId=${entrepriseId}`);
    setEtat(r.ok ? r.data : (e) => e || { erreur: true });
  }

  useEffect(() => {
    if (demo || !entrepriseId) return;
    charger();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") charger();
    }, 8000);
    return () => clearInterval(id);
  }, [entrepriseId, demo]);

  async function agir(corps) {
    if (demo) {
      setEtat((e) => appliquerDemo(e, corps));
      return;
    }
    if (ACTIONS_IMMEDIATES.has(corps.action)) setEtat((e) => appliquerDemo(e, corps));
    await sonosApi("/api/sonos/commande", { method: "POST", body: { entrepriseId, ...corps } });
    await new Promise((res) => setTimeout(res, 800)); // Sonos met un instant à refléter le changement
    await charger();
  }

  return { etat, agir };
}

// Place à laisser à l'écran kiosque pour que le lecteur ne cache rien : à droite (grand) ou en bas (compact).
export const reservePourMode = (mode) => ({
  paddingRight: mode === "large" ? 340 : 0,
  paddingBottom: mode === "compact" ? 84 : 0,
  transition: "padding .3s ease",
});

const pochette = (g) => (g?.image ? <img src={g.image} alt="" /> : <IconMusique className="gozly-icon" />);

// Lecteur Musique des kiosques. mode : "compact" (petite barre au centre en bas), "large" (panneau à droite)
// ou "plein" (l'écran kiosque Musique lui-même). Tout tient à l'écran, sans défilement.
export default function MusiqueEpingle({ entrepriseId, mode = "compact", demo = false, onMode }) {
  const { t } = useLangue();
  const { etat, agir } = useSonos({ entrepriseId, demo });
  const [cibleId, setCibleId] = useState(null);

  if (!etat) return null;
  const groupes = etat.groupes || [];
  const pasPret = !etat.lie || etat.expire || etat.erreur || groupes.length === 0;
  if (pasPret && mode === "compact") return null;

  const cible = groupes.find((g) => g.id === cibleId) || groupes.find((g) => g.etat === "PLAYING") || groupes[0] || null;
  const joue = cible?.etat === "PLAYING";
  const bascule = () => agir({ action: joue ? "pause" : "lecture", groupeId: cible.id });
  const titre = cible?.titre || t("kq.mus.rien");
  const sous = cible?.artiste || t(cible?.etat === "PLAYING" ? "kq.mus.enLecture" : cible?.etat === "PAUSED" ? "kq.mus.enPause" : "kq.mus.arrete");

  const volumes = groupes.map((g) => g.volume).filter((v) => v != null);
  const volumeGeneral = volumes.length ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length) : null;

  const transport = (
    <div className="mkp-transport">
      <button type="button" className="mkp-rond" onClick={() => agir({ action: "precedent", groupeId: cible.id })} aria-label={t("kq.mus.precedent")}>
        <Precedent />
      </button>
      <button type="button" className="mkp-rond principal" onClick={bascule} aria-label={t(joue ? "kq.mus.pause" : "kq.mus.lecture")}>
        {joue ? <Pause /> : <Lecture />}
      </button>
      <button type="button" className="mkp-rond" onClick={() => agir({ action: "suivant", groupeId: cible.id })} aria-label={t("kq.mus.suivant")}>
        <Suivant />
      </button>
    </div>
  );

  if (mode === "compact") {
    return (
      <div className="mkp mkp-compact">
        <div className="mkp-pochette petite">{pochette(cible)}</div>
        <div className="mkp-textes">
          <div className="mkp-titre">{titre}</div>
          <div className="mkp-sous">{sous}</div>
        </div>
        {transport}
        <button type="button" className="mkp-mini" onClick={() => onMode?.("large")} aria-label={t("kq.mus.agrandir")}>
          <Agrandir />
        </button>
        <button type="button" className="mkp-mini" onClick={() => onMode?.("off")} aria-label={t("kq.mus.fermer")}>
          <Fermer />
        </button>
      </div>
    );
  }

  return (
    <aside className={`mkp mkp-large${mode === "plein" ? " plein" : ""}`}>
      <div className="mkp-tete">
        <span className="mkp-tete-titre">
          <IconMusique className="gozly-icon" /> {t("kq.k.musique.nom")}
        </span>
        {mode !== "plein" && (
          <span className="mkp-tete-boutons">
            <button type="button" className="mkp-mini" onClick={() => onMode?.("compact")} aria-label={t("kq.mus.reduire")}>
              <Reduire />
            </button>
            <button type="button" className="mkp-mini" onClick={() => onMode?.("off")} aria-label={t("kq.mus.fermer")}>
              <Fermer />
            </button>
          </span>
        )}
      </div>

      {pasPret ? (
        <p className="mkp-vide">{t("kq.mus.pasLie")}</p>
      ) : (
        <div className="mkp-corps">
          <div className="mkp-colonne">
            <div className="mkp-pochette">{pochette(cible)}</div>
            <div className="mkp-textes centre">
              <div className="mkp-titre">{titre}</div>
              <div className="mkp-sous">{sous}</div>
            </div>
            {transport}
            <div className="mkp-general">
              <span className="mkp-etiquette">{t("kq.mus.volumeGeneral")}</span>
              <div className="mkp-volume">
                <HautParleur className="mkp-picto" />
                <Curseur valeur={volumeGeneral} label={t("kq.mus.volumeGeneral")} onValider={(v) => agir({ action: "toutVolume", volume: v })} />
                <strong>{volumeGeneral ?? "–"}</strong>
              </div>
            </div>
          </div>

          <div className="mkp-colonne mkp-groupes">
            <span className="mkp-etiquette">{t("kq.mus.groupes")}</span>
            {groupes.map((g) => (
              <div className={`mkp-groupe${g.id === cible?.id ? " actif" : ""}`} key={g.id}>
                <button type="button" className="mkp-groupe-nom" onClick={() => setCibleId(g.id)}>
                  <span className={`mkp-pastille ${g.etat === "PLAYING" ? "joue" : ""}`} />
                  <span>{g.nom}</span>
                </button>
                <button type="button" className="mkp-mini" onClick={() => agir({ action: g.etat === "PLAYING" ? "pause" : "lecture", groupeId: g.id })} aria-label={t(g.etat === "PLAYING" ? "kq.mus.pause" : "kq.mus.lecture")}>
                  {g.etat === "PLAYING" ? <Pause /> : <Lecture />}
                </button>
                <div className="mkp-groupe-volume">
                  <Curseur valeur={g.volume} label={`${t("kq.mus.volume")} ${g.nom}`} onValider={(v) => agir({ action: "volumeGroupe", groupeId: g.id, volume: v })} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
