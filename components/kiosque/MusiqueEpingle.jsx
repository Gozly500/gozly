"use client";

import { useEffect, useRef, useState } from "react";
import { sonosApi } from "@/lib/sonosClient";
import { ACTIONS_IMMEDIATES, CONTENU_DEMO, appliquerDemo, etatDemo } from "@/lib/sonosDemo";
import { logoPlateforme } from "@/lib/plateformesMusique";
import { useLangue } from "@/components/moi/LangueContext";
import { IconMusique } from "@/components/icons/GozlyIcons";
import Curseur from "@/components/CurseurVolume";

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
const Fermer = (p) => <Trait {...p}><path d="M6 6l12 12M18 6L6 18" /></Trait>;
const HautParleur = (p) => <Trait {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 010 7" /></Trait>;
const Muet = (p) => <Trait {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M17 9l5 6M22 9l-5 6" /></Trait>;
const Retour = (p) => <Trait {...p}><path d="M15 5l-7 7 7 7" /></Trait>;

// Logo d'une plateforme (ou sa première lettre si on ne la connaît pas).
function LogoPlateforme({ nom }) {
  const logo = logoPlateforme(nom);
  if (!logo) return <span className="musique-plateforme-lettre">{String(nom || "?").slice(0, 1).toUpperCase()}</span>;
  return (
    <span className={`musique-logo ${logo.plein ? "plein" : "blanc"}`}>
      <img src={logo.src} alt="" style={logo.zoom !== 1 ? { transform: `scale(${logo.zoom})` } : undefined} />
    </span>
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
  paddingRight: mode === "large" ? 340 + 28 : 0, // largeur du panneau + une marge, pour que le contenu ne le touche pas
  paddingBottom: mode === "compact" ? 100 : 0,
  transition: "padding .3s ease",
});

const pochette = (g) => (g?.image ? <img src={g.image} alt="" /> : <IconMusique className="gozly-icon" />);

// Lecteur Musique des kiosques. mode : "compact" (petite barre au centre en bas, qui se déploie au toucher),
// "large" (panneau à droite) ou "plein" (l'écran kiosque Musique lui-même : lecteur + haut-parleurs + musique).
// Le mode se choisit seulement en épinglant (voir BoutonEpingler) ; ici on ne peut que retirer le lecteur (onMode("off")).
export default function MusiqueEpingle({ entrepriseId, mode = "compact", demo = false, onMode }) {
  const { t } = useLangue();
  const { etat, agir } = useSonos({ entrepriseId, demo });
  const [cibleId, setCibleId] = useState(null);
  const [deploye, setDeploye] = useState(false); // lecteur compact déployé (volume général + groupes)
  const racine = useRef(null);

  // Écran Musique (plein) : onglets « Haut-parleurs » / « Musique », plateformes et listes de lecture Sonos.
  const [onglet, setOnglet] = useState("hp"); // "hp" | "musique"
  const [plateforme, setPlateforme] = useState(null); // null = liste des plateformes ; sinon son nom ou "__listes"
  const [contenu, setContenu] = useState({ favoris: [], playlists: [] });
  const [deplies, setDeplies] = useState(() => new Set()); // groupes dont on voit les appareils individuels
  const [lancee, setLancee] = useState(null); // { nom, groupe } : confirmation après un clic sur une musique

  // Déployé : toucher ailleurs le replie.
  useEffect(() => {
    if (!deploye) return;
    const dehors = (e) => {
      if (racine.current && !racine.current.contains(e.target)) setDeploye(false);
    };
    document.addEventListener("pointerdown", dehors);
    return () => document.removeEventListener("pointerdown", dehors);
  }, [deploye]);

  // Favoris et listes de lecture Sonos : chargés une fois, seulement pour l'écran Musique.
  useEffect(() => {
    if (mode !== "plein") return;
    if (demo) {
      setContenu(CONTENU_DEMO);
      return;
    }
    if (!entrepriseId) return;
    let ignore = false;
    sonosApi(`/api/sonos/contenu?entrepriseId=${entrepriseId}`).then((r) => {
      if (!ignore && r.ok) setContenu({ favoris: r.data.favoris || [], playlists: r.data.playlists || [] });
    });
    return () => {
      ignore = true;
    };
  }, [mode, demo, entrepriseId]);

  useEffect(() => {
    if (!lancee) return;
    const id = setTimeout(() => setLancee(null), 3500);
    return () => clearTimeout(id);
  }, [lancee]);

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

  const basculerAppareils = (id) =>
    setDeplies((cur) => {
      const suivant = new Set(cur);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });

  // Une ligne de groupe : nom, lecture/pause, volume du groupe, et — si le groupe a plusieurs appareils — leurs volumes un par un.
  const ligneGroupe = (g) => {
    const multi = g.joueurs.length > 1;
    const ouvert = deplies.has(g.id);
    return (
      <div className={`mkp-groupe${g.id === cible?.id ? " actif" : ""}${multi ? " multi" : ""}`} key={g.id}>
        <button type="button" className="mkp-groupe-nom" onClick={() => setCibleId(g.id)}>
          <span className={`mkp-pastille ${g.etat === "PLAYING" ? "joue" : ""}`} />
          <span>{g.nom}</span>
        </button>
        <button type="button" className="mkp-mini" onClick={() => agir({ action: g.etat === "PLAYING" ? "pause" : "lecture", groupeId: g.id })} aria-label={t(g.etat === "PLAYING" ? "kq.mus.pause" : "kq.mus.lecture")}>
          {g.etat === "PLAYING" ? <Pause /> : <Lecture />}
        </button>
        <div className="mkp-groupe-volume">
          <Curseur valeur={g.volume} muet={g.muet} label={`${t("kq.mus.volume")} ${g.nom}`} onValider={(v) => agir({ action: "volumeGroupe", groupeId: g.id, volume: v })} />
        </div>
        {multi && (
          <button type="button" className="mkp-appareils-bouton" aria-expanded={ouvert} onClick={() => basculerAppareils(g.id)}>
            {t("kq.mus.nAppareils", { n: g.joueurs.length })} <span className={`mkp-chevron${ouvert ? " ouvert" : ""}`}>›</span>
          </button>
        )}
        {multi && ouvert && (
          <div className="mkp-appareils">
            {g.joueurs.map((j) => (
              <div className="mkp-appareil" key={j.id}>
                <span className="mkp-appareil-nom">{j.nom}</span>
                <Curseur valeur={j.volume} muet={j.muet} label={`${t("kq.mus.volume")} ${j.nom}`} onValider={(v) => agir({ action: "volumeJoueur", joueurId: j.id, volume: v })} />
                <button type="button" className="mkp-mini" aria-pressed={!!j.muet} aria-label={t(j.muet ? "kq.mus.reactiverSon" : "kq.mus.muet")} onClick={() => agir({ action: "muetJoueur", joueurId: j.id, muet: !j.muet })}>
                  {j.muet ? <Muet /> : <HautParleur />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Plateformes (favoris Sonos regroupés par service) et listes de lecture ; un clic joue sur le groupe choisi.
  const plateformes = [...new Set(contenu.favoris.map((f) => f.service || t("kq.mus.autres")))];
  const elements = [
    ...contenu.favoris.map((f) => ({ cle: "f" + f.id, type: "favori", id: f.id, nom: f.nom, image: f.image, sous: f.service || t("kq.mus.favori"), service: f.service || t("kq.mus.autres") })),
    ...contenu.playlists.map((p) => ({ cle: "l" + p.id, type: "playlist", id: p.id, nom: p.nom, image: null, sous: t("kq.mus.liste") + (p.pistes ? ` · ${p.pistes}` : ""), service: "__listes" })),
  ].filter((e) => e.service === plateforme);
  const nbParPlateforme = (p) => contenu.favoris.filter((f) => (f.service || t("kq.mus.autres")) === p).length;

  function lancer(e) {
    if (!cible) return;
    agir(e.type === "favori" ? { action: "favori", groupeId: cible.id, favoriId: e.id } : { action: "playlist", groupeId: cible.id, playlistId: e.id });
    setLancee({ nom: e.nom, groupe: cible.nom });
  }

  const panneauMusique = (
    <div className="mkp-musique">
      <div className="mkp-chips">
        <span className="mkp-etiquette">{t("kq.mus.jouerSur")}</span>
        {groupes.map((g) => (
          <button type="button" key={g.id} className={`musique-chip${g.id === cible?.id ? " actif" : ""}`} aria-pressed={g.id === cible?.id} onClick={() => setCibleId(g.id)}>
            {g.nom}
          </button>
        ))}
      </div>

      {lancee && <p className="mkp-lancee">{t("kq.mus.lancee", { nom: lancee.nom, groupe: lancee.groupe })}</p>}

      {plateforme === null ? (
        plateformes.length === 0 && contenu.playlists.length === 0 ? (
          <p className="mkp-vide">{t("kq.mus.aucunFavori")}</p>
        ) : (
          <div className="musique-plateformes">
            {plateformes.map((p) => (
              <button type="button" key={p} className="musique-plateforme" onClick={() => setPlateforme(p)}>
                <LogoPlateforme nom={p} />
                <span className="musique-plateforme-textes">
                  <span className="musique-plateforme-nom">{p}</span>
                  <span className="musique-plateforme-sous">{t(nbParPlateforme(p) > 1 ? "kq.mus.nFavoris" : "kq.mus.unFavori", { n: nbParPlateforme(p) })}</span>
                </span>
              </button>
            ))}
            {contenu.playlists.length > 0 && (
              <button type="button" className="musique-plateforme" onClick={() => setPlateforme("__listes")}>
                <span className="musique-plateforme-lettre">
                  <IconMusique className="gozly-icon" />
                </span>
                <span className="musique-plateforme-textes">
                  <span className="musique-plateforme-nom">{t("kq.mus.listesSonos")}</span>
                  <span className="musique-plateforme-sous">{t("kq.mus.nListes", { n: contenu.playlists.length })}</span>
                </span>
              </button>
            )}
          </div>
        )
      ) : (
        <>
          <div className="musique-retour">
            <button type="button" className="mkp-mini" onClick={() => setPlateforme(null)} aria-label={t("kq.mus.retour")}>
              <Retour />
            </button>
            {plateforme !== "__listes" && <LogoPlateforme nom={plateforme} />}
            <strong>{plateforme === "__listes" ? t("kq.mus.listesSonos") : plateforme}</strong>
          </div>
          {elements.length === 0 ? (
            <p className="mkp-vide">{t("kq.mus.rienIci")}</p>
          ) : (
            <div className="musique-grille">
              {elements.map((e) => (
                <button type="button" key={e.cle} className="musique-carte" disabled={!cible} onClick={() => lancer(e)}>
                  <span className="musique-carte-image">{e.image ? <img src={e.image} alt="" /> : <IconMusique className="gozly-icon" />}</span>
                  <span className="musique-carte-textes">
                    <span className="musique-carte-nom">{e.nom}</span>
                    <span className="musique-carte-sous">{e.sous}</span>
                  </span>
                  <Lecture className="musique-carte-lire" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  if (mode === "compact") {
    // Toucher la pochette déploie le lecteur vers le haut (volume général et volume de chaque groupe), en douceur.
    return (
      <div ref={racine} className={`mkp mkp-compact${deploye ? " deploye" : ""}`}>
        <div className="mkp-compact-tete">
          <button type="button" className="mkp-ouvre" onClick={() => setDeploye((d) => !d)} aria-expanded={deploye} aria-label={t("kq.mus.deployer")}>
            <span className="mkp-pochette petite">{pochette(cible)}</span>
            <span className="mkp-textes">
              <span className="mkp-titre">{titre}</span>
              <span className="mkp-sous">{sous}</span>
            </span>
          </button>
          {transport}
          <button type="button" className="mkp-mini" onClick={() => onMode?.("off")} aria-label={t("kq.mus.fermer")}>
            <Fermer />
          </button>
        </div>
        <div className="mkp-deploiement" inert={deploye ? undefined : ""}>
          <div className="mkp-deploiement-interne">
            <div className="mkp-general">
              <span className="mkp-etiquette">{t("kq.mus.volumeGeneral")}</span>
              <div className="mkp-volume">
                <HautParleur className="mkp-picto" />
                <Curseur valeur={volumeGeneral} label={t("kq.mus.volumeGeneral")} onValider={(v) => agir({ action: "toutVolume", volume: v })} />
                <strong>{volumeGeneral ?? "–"}</strong>
              </div>
            </div>
            <span className="mkp-etiquette">{t("kq.mus.groupes")}</span>
            <div className="mkp-tuiles">
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
        </div>
      </div>
    );
  }

  const plein = mode === "plein";
  return (
    <aside className={`mkp mkp-large${plein ? " plein" : ""}`}>
      <div className="mkp-tete">
        <span className="mkp-tete-titre">
          <IconMusique className="gozly-icon" /> {t("kq.k.musique.nom")}
        </span>
        {!plein && (
          <span className="mkp-tete-boutons">
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

          {plein ? (
            <div className="mkp-colonne mkp-droite">
              <div className="mkp-onglets" role="tablist">
                <button type="button" role="tab" aria-selected={onglet === "hp"} className={`mkp-onglet${onglet === "hp" ? " actif" : ""}`} onClick={() => setOnglet("hp")}>
                  {t("kq.mus.ongletHp")}
                </button>
                <button type="button" role="tab" aria-selected={onglet === "musique"} className={`mkp-onglet${onglet === "musique" ? " actif" : ""}`} onClick={() => setOnglet("musique")}>
                  {t("kq.mus.ongletMusique")}
                </button>
              </div>
              {onglet === "hp" ? <div className="mkp-groupes">{groupes.map(ligneGroupe)}</div> : panneauMusique}
            </div>
          ) : (
            <div className="mkp-colonne mkp-groupes">
              <span className="mkp-etiquette">{t("kq.mus.groupes")}</span>
              {groupes.map(ligneGroupe)}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
