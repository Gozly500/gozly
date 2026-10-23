"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashSidebar from "@/components/DashSidebar";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { sonosApi, ETATS_LECTURE } from "@/lib/sonosClient";
import { ACTIONS_IMMEDIATES, CONTENU_DEMO, appliquerDemo, etatDemo } from "@/lib/sonosDemo";
import SimpleSelect from "@/components/SimpleSelect";
import { IconFlecheBas, IconFlecheDroite, IconFlecheGauche, IconFlecheHaut, IconPlus } from "@/components/icons/Pictogrammes";
import { IconMusique } from "@/components/icons/GozlyIcons";
import { logoPlateforme } from "@/lib/plateformesMusique";
import BetaBadge from "@/components/BetaBadge";
import Curseur from "@/components/CurseurVolume";
import { useT } from "@/components/LangProvider";

const Svg = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    {children}
  </svg>
);
const Trait = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);
const Lecture = (p) => <Svg {...p}><path d="M8 5v14l11-7z" /></Svg>;
const Pause = (p) => <Svg {...p}><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></Svg>;
const Precedent = (p) => <Svg {...p}><path d="M6 5h2v14H6zM20 5v14L9 12z" /></Svg>;
const Suivant = (p) => <Svg {...p}><path d="M16 5h2v14h-2zM4 5l11 7-11 7z" /></Svg>;
const Moins = (p) => <Trait {...p}><path d="M5 12h14" /></Trait>;
const Plus = (p) => <Trait {...p}><path d="M12 5v14M5 12h14" /></Trait>;
const Poubelle = (p) => <Trait {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Trait>;
const HautParleur = (p) => <Trait {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" /></Trait>;
const Muet = (p) => <Trait {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M17 9l5 6M22 9l-5 6" /></Trait>;

const PAS_VOLUME = 5;

// Logo d'une plateforme (ou sa première lettre si on ne la connaît pas).
function LogoPlateforme({ nom, petit = false }) {
  const logo = logoPlateforme(nom);
  if (!logo) return <span className={`musique-plateforme-lettre${petit ? " petit" : ""}`}>{String(nom || "?").slice(0, 1).toUpperCase()}</span>;
  return (
    <span className={`musique-logo ${logo.plein ? "plein" : "blanc"}${petit ? " petit" : ""}`}>
      <img src={logo.src} alt="" style={logo.zoom !== 1 ? { transform: `scale(${logo.zoom})` } : undefined} />
    </span>
  );
}

// Réglage de volume : − curseur + valeur, et un bouton Muet.
function ReglageVolume({ volume, muet, onVolume, onMuet, t, compact = false }) {
  const bouge = (delta) => onVolume(Math.max(0, Math.min(100, (volume ?? 0) + delta)));
  return (
    <div className={`musique-reglage${compact ? " compact" : ""}`}>
      <button type="button" className="musique-pm" onClick={() => bouge(-PAS_VOLUME)} disabled={volume == null} aria-label={t("Baisser le volume")}>
        <Moins />
      </button>
      <Curseur valeur={volume} muet={muet} onValider={onVolume} label={t("Volume")} />
      <button type="button" className="musique-pm" onClick={() => bouge(PAS_VOLUME)} disabled={volume == null} aria-label={t("Monter le volume")}>
        <Plus />
      </button>
      <strong className="musique-valeur">{volume ?? "–"}</strong>
      <button type="button" className={`musique-muet${muet ? " actif" : ""}`} onClick={() => onMuet(!muet)} aria-pressed={!!muet} title={muet ? t("Réactiver le son") : t("Muet")}>
        {muet ? <Muet /> : <HautParleur />}
        <span>{muet ? t("Réactiver le son") : t("Muet")}</span>
      </button>
    </div>
  );
}

// Ligne dépliable (haut-parleur ou groupe). `actions` : boutons à droite de l'en-tête.
function Accordeon({ titre, sous, ouvert, onToggle, actions, distinct, icone, children }) {
  return (
    <div className={`musique-acc${distinct ? " groupe" : ""}${ouvert ? " ouvert" : ""}`}>
      <div className="musique-acc-tete">
        <button type="button" className="musique-acc-bouton" onClick={onToggle} aria-expanded={ouvert}>
          <span className="musique-acc-icone">{icone}</span>
          <span className="musique-acc-textes">
            <span className="musique-acc-titre">{titre}</span>
            {sous && <span className="musique-acc-sous">{sous}</span>}
          </span>
          <IconFlecheBas className="gozly-icon-inline musique-acc-fleche" />
        </button>
        {actions && <div className="musique-acc-actions">{actions}</div>}
      </div>
      <div className="musique-acc-enveloppe" inert={ouvert ? undefined : ""}>
        <div className="musique-acc-corps">{children}</div>
      </div>
    </div>
  );
}

export default function MusiqueContent() {
  const { t } = useT();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);

  const [etat, setEtat] = useState(null); // { configure, lie, expire, groupes }
  const [contenu, setContenu] = useState({ favoris: [], playlists: [] });
  const [message, setMessage] = useState(null); // { type: "ok" | "err", text }
  const [occupe, setOccupe] = useState(false);
  const [deliageConfirme, setDeliageConfirme] = useState(false);
  const contenuCharge = useRef(false);
  const [demo, setDemo] = useState(false); // ?demo=1 : faux haut-parleurs pour voir la page sans compte Sonos

  const [cibleId, setCibleId] = useState(null); // groupe sur lequel on joue la musique choisie
  const [sens, setSens] = useState("avant"); // sens de l'animation de la liste des plateformes
  const [plateforme, setPlateformeBrut] = useState(null); // null = liste des plateformes ; sinon le nom d'une plateforme ou "__listes"
  const choisirPlateforme = (p) => {
    setSens(p === null ? "arriere" : "avant");
    setPlateformeBrut(p);
  };
  const [ouverts, setOuverts] = useState(() => new Set()); // lignes dépliées ("j:id" ou "g:id")
  const [ajoutGroupeId, setAjoutGroupeId] = useState(null); // groupe dont on choisit un haut-parleur à ajouter
  const [nouveauGroupe, setNouveauGroupe] = useState(false);
  const [nouveauIds, setNouveauIds] = useState(() => new Set());

  useEffect(() => {
    let ignore = false;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      if (ignore) return;
      setUser(session.user);
      supabase
        .from("admins")
        .select("id")
        .eq("email", session.user.email)
        .maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));

      const { entrepriseId: eid, besoinChoix, invitationsEnAttente } = await resoudreEntrepriseActive(supabase);
      if (ignore) return;
      if (invitationsEnAttente > 0) {
        router.push("/invitations");
        return;
      }
      if (besoinChoix) {
        router.push("/dashboards");
        return;
      }
      setEntrepriseId(eid);
      setChecking(false);
    });
    return () => {
      ignore = true;
    };
  }, [router]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      setDemo(true);
      setEtat(etatDemo());
      setContenu(CONTENU_DEMO);
    }
  }, []);

  // Retour de la page de connexion Sonos (?sonos=ok | refuse | erreur).
  useEffect(() => {
    const resultat = new URLSearchParams(window.location.search).get("sonos");
    if (!resultat) return;
    setMessage(
      resultat === "ok"
        ? { type: "ok", text: t("Ton compte Sonos est lié.") }
        : { type: "err", text: t(resultat === "refuse" ? "Tu as refusé l'accès à ton compte Sonos." : "La liaison avec Sonos a échoué. Réessaie.") }
    );
    window.history.replaceState(null, "", "/dashboard/musique");
  }, []);

  async function chargerEtat() {
    if (!entrepriseId || demo) return;
    const r = await sonosApi(`/api/sonos/etat?entrepriseId=${entrepriseId}`);
    if (r.ok) {
      setEtat(r.data);
      if (r.data.lie && !r.data.expire && !contenuCharge.current) {
        contenuCharge.current = true;
        const c = await sonosApi(`/api/sonos/contenu?entrepriseId=${entrepriseId}`);
        if (c.ok) setContenu(c.data);
      }
    } else {
      setEtat((e) => e || { configure: true, lie: true, groupes: [] });
      setMessage({ type: "err", text: r.data?.error || t("Sonos n'a pas répondu.") });
    }
  }

  useEffect(() => {
    if (!entrepriseId || demo) return;
    chargerEtat();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") chargerEtat();
    }, 8000);
    return () => clearInterval(id);
  }, [entrepriseId, demo]);

  // Envoie une commande. Volume, muet et lecture s'affichent tout de suite, avant la réponse de Sonos.
  async function agir(corps) {
    if (demo) {
      setEtat((e) => appliquerDemo(e, corps));
      return;
    }
    const immediate = ACTIONS_IMMEDIATES.has(corps.action);
    if (immediate) setEtat((e) => appliquerDemo(e, corps));
    else setOccupe(true);
    setMessage(null);
    const r = await sonosApi("/api/sonos/commande", { method: "POST", body: { entrepriseId, ...corps } });
    if (!r.ok) setMessage({ type: "err", text: r.data?.error || t("La commande a échoué.") });
    await new Promise((res) => setTimeout(res, 800)); // Sonos met un instant à refléter le changement
    await chargerEtat();
    if (!immediate) setOccupe(false);
  }

  async function lier() {
    setOccupe(true);
    const r = await sonosApi("/api/sonos/connecter", { method: "POST", body: { entrepriseId } });
    if (r.ok && r.data.url) {
      window.location.href = r.data.url;
      return;
    }
    setMessage({ type: "err", text: r.data?.error || t("La liaison avec Sonos a échoué. Réessaie.") });
    setOccupe(false);
  }

  async function delier() {
    setOccupe(true);
    const r = await sonosApi("/api/sonos/deconnecter", { method: "POST", body: { entrepriseId } });
    if (r.ok) {
      contenuCharge.current = false;
      setContenu({ favoris: [], playlists: [] });
      setDeliageConfirme(false);
      setEtat({ configure: true, lie: false });
    } else {
      setMessage({ type: "err", text: r.data?.error || t("La déconnexion a échoué.") });
    }
    setOccupe(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const basculer = (cle) =>
    setOuverts((cur) => {
      const suivant = new Set(cur);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.entreprise || user?.email;
  const groupes = etat?.groupes || [];
  const joueurs = groupes.flatMap((g) => g.joueurs.map((j) => ({ ...j, groupeId: g.id, groupeNom: g.nom, groupeTaille: g.joueurs.length })));
  const groupesMultiples = groupes.filter((g) => g.joueurs.length > 1);
  // « Partout » : cible virtuelle qui envoie la même commande à tous les groupes, sans les regrouper.
  const jouee = groupes.find((g) => g.etat === "PLAYING");
  const volumesTous = groupes.map((g) => g.volume).filter((v) => v != null);
  const partout =
    groupes.length > 1
      ? {
          id: "__partout",
          nom: t("Partout"),
          etat: jouee ? "PLAYING" : groupes.every((g) => g.etat === "IDLE") ? "IDLE" : "PAUSED",
          volume: volumesTous.length ? Math.round(volumesTous.reduce((a, b) => a + b, 0) / volumesTous.length) : null,
          muet: groupes.every((g) => g.muet),
          titre: jouee?.titre || null,
          artiste: jouee?.artiste || null,
          image: jouee?.image || null,
          joueurs: joueurs,
        }
      : null;
  const cible = (cibleId === "__partout" && partout) || groupes.find((g) => g.id === cibleId) || groupes.find((g) => g.etat === "PLAYING") || groupes[0] || null;
  // Identifie la cible dans une commande : un groupe, ou tous les groupes.
  const versCible = (c) => (c.id === "__partout" ? { partout: true } : { groupeId: c.id });

  // Musique : les favoris Sonos (classés par plateforme) et les listes de lecture Sonos.
  const plateformes = [...new Set(contenu.favoris.map((f) => f.service || t("Autres")))];
  const elements = [
    ...contenu.favoris.map((f) => ({ cle: "f" + f.id, type: "favori", id: f.id, nom: f.nom, image: f.image, sous: f.service || t("Favori"), service: f.service || t("Autres") })),
    ...contenu.playlists.map((p) => ({ cle: "l" + p.id, type: "playlist", id: p.id, nom: p.nom, image: null, sous: t("Liste de lecture") + (p.pistes ? ` · ${p.pistes}` : ""), service: "__listes" })),
  ].filter((e) => e.service === plateforme);
  const nbParPlateforme = (p) => contenu.favoris.filter((f) => (f.service || t("Autres")) === p).length;
  const nomPlateforme = plateforme === "__listes" ? t("Listes Sonos") : plateforme;

  function lancer(e) {
    if (!cible) return;
    agir(e.type === "favori" ? { action: "favori", ...versCible(cible), favoriId: e.id } : { action: "playlist", ...versCible(cible), playlistId: e.id });
  }

  const ligneJoueur = (j, { dansGroupe }) => (
    <div className="musique-membre" key={j.id}>
      <div className="musique-membre-tete">
        <span className="musique-membre-nom">{j.nom}</span>
        {dansGroupe && (
          <button type="button" className="musique-icone-btn danger" disabled={occupe} onClick={() => agir({ action: "retirerDuGroupe", groupeId: j.groupeId, joueurId: j.id })} title={t("Retirer du groupe")} aria-label={t("Retirer du groupe")}>
            <Poubelle />
          </button>
        )}
      </div>
      <ReglageVolume compact t={t} volume={j.volume} muet={j.muet} onVolume={(v) => agir({ action: "volumeJoueur", joueurId: j.id, volume: v })} onMuet={(m) => agir({ action: "muetJoueur", joueurId: j.id, muet: m })} />
    </div>
  );

  return (
    <div className="dash-layout">
      <DashSidebar active="musique" displayName={displayName} userEmail={user?.email} isAdmin={isAdmin} onLogout={handleLogout} entrepriseId={entrepriseId} />

      <main className="dash-main">
        <div className="dash-main-inner musique-large">
          <header className="dash-hero-inline">
            <div>
              <h1>
                {t("Musique")}
                <BetaBadge hauteur={26} />
              </h1>
              <p>{t("Contrôle ton système Sonos : lecture, volume, listes de lecture et haut-parleurs.")}</p>
            </div>
          </header>

          {demo && <p className="settings-msg ok">{t("Mode démonstration : de faux haut-parleurs, rien n'est envoyé à Sonos.")}</p>}
          {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}

          {!entrepriseId ? (
            <p style={{ color: "var(--text-dim)" }}>{t("Aucune entreprise associée à ce compte.")}</p>
          ) : !etat ? (
            <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>
          ) : !etat.configure ? (
            <div className="settings-section">
              <h3>{t("Liaison Sonos pas encore activée")}</h3>
              <p className="panel-hint">{t("La clé de l'intégration Sonos n'est pas encore configurée sur Gozly. Reviens bientôt!")}</p>
            </div>
          ) : !etat.lie || etat.expire ? (
            <div className="settings-section">
              <h3>{etat.expire ? t("La liaison avec Sonos a expiré") : t("Lier ton compte Sonos")}</h3>
              <p className="panel-hint">
                {t("Connecte-toi à ton compte Sonos pour contrôler tes haut-parleurs depuis Gozly. Gozly ne voit que la lecture et le volume de ton système, et tu peux retirer l'accès à tout moment.")}
              </p>
              <button type="button" className="submit-btn" disabled={occupe} onClick={lier}>
                {occupe ? t("Ouverture...") : t("Lier mon compte Sonos")}
              </button>
            </div>
          ) : (
            <>
              {groupes.length === 0 && !demo && (
                <div className="settings-section">
                  <h3>{t("Ton compte Sonos est lié, mais aucun haut-parleur n'a été trouvé")}</h3>
                  <p className="panel-hint">{t("Les haut-parleurs Sonos du compte apparaîtront ici dès qu'il y en aura. En attendant, tu peux voir à quoi ressemble la page avec de faux haut-parleurs.")}</p>
                  <a href="/dashboard/musique?demo=1" className="submit-btn" style={{ display: "inline-block" }}>
                    {t("Voir la démo")}
                  </a>
                </div>
              )}
              <div className="musique-colonnes">
                {/* ---------- Colonne de gauche : la musique ---------- */}
                <div className="musique-col musique-col-gauche">
                  <section className="settings-section musique-ecoute">
                    <div className="musique-ecoute-tete">
                      <h3>{t("En ce moment")}</h3>
                      {groupes.length > 0 && (
                        <div className="musique-cible">
                          <span>{t("Jouer sur")}</span>
                          <SimpleSelect options={[...(partout ? [{ id: "__partout", label: t("Partout") }] : []), ...groupes.map((g) => ({ id: g.id, label: g.nom }))]} value={cible?.id} onChange={setCibleId} />
                        </div>
                      )}
                    </div>

                    {!cible ? (
                      <p className="chat-empty">{t("Aucun haut-parleur trouvé sur ce compte Sonos.")}</p>
                    ) : (
                      <>
                        <div className="musique-piste">
                          <div className="musique-pochette">{cible.image ? <img src={cible.image} alt="" /> : <IconMusique className="gozly-icon" />}</div>
                          <div className="musique-piste-textes">
                            <div className="musique-piste-titre">{cible.titre || t("Rien en lecture")}</div>
                            <div className="musique-piste-sous">
                              {cible.artiste ? `${cible.artiste} · ` : ""}
                              {t(ETATS_LECTURE[cible.etat] || "Arrêté")}
                            </div>
                          </div>
                        </div>
                        <div className="musique-transport">
                          <button type="button" className="musique-rond" disabled={occupe} onClick={() => agir({ action: "precedent", ...versCible(cible) })} aria-label={t("Précédent")}>
                            <Precedent />
                          </button>
                          <button
                            type="button"
                            className="musique-rond principal"
                            onClick={() => agir({ action: cible.etat === "PLAYING" ? "pause" : "lecture", ...versCible(cible) })}
                            aria-label={cible.etat === "PLAYING" ? t("Pause") : t("Lecture")}
                          >
                            {cible.etat === "PLAYING" ? <Pause /> : <Lecture />}
                          </button>
                          <button type="button" className="musique-rond" disabled={occupe} onClick={() => agir({ action: "suivant", ...versCible(cible) })} aria-label={t("Suivant")}>
                            <Suivant />
                          </button>
                        </div>
                        <ReglageVolume t={t} volume={cible.volume} muet={cible.muet} onVolume={(v) => agir({ action: "volumeGroupe", ...versCible(cible), volume: v })} onMuet={(m) => agir({ action: "muetGroupe", ...versCible(cible), muet: m })} />
                      </>
                    )}
                  </section>

                  <section className="settings-section">
                    <div key={plateforme ?? "liste"} className={`musique-vue ${sens}`}>
                    {plateforme === null ? (
                      <>
                        <h3>{t("Musique de ton Sonos")}</h3>
                        <p className="panel-hint" style={{ marginTop: 0 }}>{t("Choisis une plateforme pour voir ses favoris et ses listes de lecture.")}</p>
                        {plateformes.length === 0 && contenu.playlists.length === 0 ? (
                          <p className="chat-empty">{t("Aucun favori Sonos pour l'instant. Ajoute des favoris dans l'application Sonos et ils apparaîtront ici.")}</p>
                        ) : (
                          <div className="musique-plateformes">
                            {plateformes.map((p) => (
                              <button type="button" key={p} className="musique-plateforme" onClick={() => choisirPlateforme(p)}>
                                <LogoPlateforme nom={p} />
                                <span className="musique-plateforme-textes">
                                  <span className="musique-plateforme-nom">{p}</span>
                                  <span className="musique-plateforme-sous">{nbParPlateforme(p)} {t(nbParPlateforme(p) > 1 ? "favoris" : "favori")}</span>
                                </span>
                                <IconFlecheDroite className="gozly-icon-inline" />
                              </button>
                            ))}
                            {contenu.playlists.length > 0 && (
                              <button type="button" className="musique-plateforme" onClick={() => choisirPlateforme("__listes")}>
                                <span className="musique-plateforme-lettre"><IconMusique className="gozly-icon" /></span>
                                <span className="musique-plateforme-textes">
                                  <span className="musique-plateforme-nom">{t("Listes Sonos")}</span>
                                  <span className="musique-plateforme-sous">{contenu.playlists.length} {t("listes de lecture")}</span>
                                </span>
                                <IconFlecheDroite className="gozly-icon-inline" />
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="musique-retour">
                          <button type="button" className="admin-icon-btn" onClick={() => choisirPlateforme(null)} aria-label={t("Retour aux plateformes")}>
                            <IconFlecheGauche className="gozly-icon" />
                          </button>
                          {plateforme !== "__listes" && <LogoPlateforme nom={plateforme} petit />}
                          <h3 style={{ margin: 0 }}>{nomPlateforme}</h3>
                          {cible && <span className="musique-retour-cible">{t("Jouer sur")} {cible.nom}</span>}
                        </div>
                        {elements.length === 0 ? (
                          <p className="chat-empty">{t("Rien dans cette plateforme pour l'instant.")}</p>
                        ) : (
                          <div className="musique-grille liste">
                            {elements.map((e) => (
                              <button type="button" key={e.cle} className="musique-carte" disabled={!cible || occupe} onClick={() => lancer(e)} title={cible ? `${t("Jouer sur")} ${cible.nom}` : ""}>
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
                    <p className="panel-hint" style={{ marginTop: "14px" }}>
                      {t("Gozly affiche les favoris et les listes de lecture de ton Sonos. Pour en ajouter ou en créer, utilise l'application Sonos ou ta plateforme musicale : elles apparaîtront ici.")}
                    </p>
                  </section>
                </div>

                {/* ---------- Colonne de droite : haut-parleurs et groupes ---------- */}
                <div className="musique-col musique-col-droite">
                  <section className="settings-section">
                    <div className="musique-droite-tete">
                      <h3>{t("Haut-parleurs et groupes")}</h3>
                      <button type="button" className="admin-icon-btn" disabled={occupe || groupes.length === 0} onClick={() => agir({ action: "toutPause" })}>
                        <Pause className="musique-picto" /> {t("Tout en pause")}
                      </button>
                    </div>

                    <div className="musique-sous-titre">
                      <span>{t("Groupes")}</span>
                      <button type="button" className="musique-icone-btn" disabled={joueurs.length < 2} onClick={() => { setNouveauGroupe((v) => !v); setNouveauIds(new Set()); }} title={t("Nouveau groupe")} aria-label={t("Nouveau groupe")}>
                        <IconPlus className="gozly-icon" />
                      </button>
                    </div>

                    {nouveauGroupe && (
                      <div className="musique-nouveau">
                        <p className="panel-hint" style={{ margin: "0 0 8px" }}>{t("Choisis au moins deux haut-parleurs")}</p>
                        <div className="musique-chips">
                          {joueurs.map((j) => (
                            <button
                              type="button"
                              key={j.id}
                              className={`musique-chip${nouveauIds.has(j.id) ? " actif" : ""}`}
                              aria-pressed={nouveauIds.has(j.id)}
                              onClick={() => setNouveauIds((cur) => { const s = new Set(cur); if (s.has(j.id)) s.delete(j.id); else s.add(j.id); return s; })}
                            >
                              {j.nom}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                          <button
                            type="button"
                            className="btn-small"
                            disabled={nouveauIds.size < 2 || occupe}
                            onClick={async () => {
                              await agir({ action: "creerGroupe", joueurIds: [...nouveauIds] });
                              setNouveauGroupe(false);
                              setNouveauIds(new Set());
                            }}
                          >
                            {t("Créer le groupe")}
                          </button>
                          <button type="button" className="admin-icon-btn" onClick={() => setNouveauGroupe(false)}>
                            {t("Annuler")}
                          </button>
                        </div>
                      </div>
                    )}

                    {groupesMultiples.length === 0 && !nouveauGroupe && <p className="musique-vide">{t("Aucun groupe : chaque haut-parleur joue seul.")}</p>}
                    {groupesMultiples.map((g) => {
                      const dispo = joueurs.filter((j) => j.groupeId !== g.id);
                      return (
                        <Accordeon
                          key={g.id}
                          distinct
                          icone={<HautParleur />}
                          titre={g.nom}
                          sous={`${g.joueurs.length} ${t("haut-parleurs")} · ${t(ETATS_LECTURE[g.etat] || "Arrêté")}`}
                          ouvert={ouverts.has("g:" + g.id)}
                          onToggle={() => basculer("g:" + g.id)}
                          actions={
                            <button type="button" className={`musique-icone-btn${ajoutGroupeId === g.id ? " actif" : ""}`} disabled={dispo.length === 0} onClick={() => { setAjoutGroupeId((cur) => (cur === g.id ? null : g.id)); setOuverts((cur) => new Set(cur).add("g:" + g.id)); }} title={t("Ajouter un haut-parleur")} aria-label={t("Ajouter un haut-parleur")}>
                              <IconPlus className="gozly-icon" />
                            </button>
                          }
                        >
                          {ajoutGroupeId === g.id && (
                            <div className="musique-ajout">
                              <div className="musique-ajout-titre">{t("Ajouter un haut-parleur")}</div>
                              {dispo.map((j) => (
                                <button type="button" key={j.id} className="musique-ajout-ligne" disabled={occupe} onClick={() => { setAjoutGroupeId(null); agir({ action: "ajouterAuGroupe", groupeId: g.id, joueurId: j.id }); }}>
                                  <IconPlus className="gozly-icon" /> {j.nom}
                                  {j.groupeTaille > 1 && <small>{j.groupeNom}</small>}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="musique-membre general">
                            <div className="musique-membre-tete">
                              <span className="musique-membre-nom">{t("Volume général")}</span>
                            </div>
                            <ReglageVolume t={t} volume={g.volume} muet={g.muet} onVolume={(v) => agir({ action: "volumeGroupe", groupeId: g.id, volume: v })} onMuet={(m) => agir({ action: "muetGroupe", groupeId: g.id, muet: m })} />
                          </div>
                          {g.joueurs.map((j) => ligneJoueur({ ...j, groupeId: g.id }, { dansGroupe: true }))}
                        </Accordeon>
                      );
                    })}

                    <div className="musique-sous-titre">
                      <span>{t("Haut-parleurs")}</span>
                    </div>
                    {joueurs.map((j) => (
                      <Accordeon
                        key={j.id}
                        icone={j.muet ? <Muet /> : <HautParleur />}
                        titre={j.nom}
                        sous={j.groupeTaille > 1 ? `${t("Dans :")} ${j.groupeNom}` : t(ETATS_LECTURE[groupes.find((g) => g.id === j.groupeId)?.etat] || "Arrêté")}
                        ouvert={ouverts.has("j:" + j.id)}
                        onToggle={() => basculer("j:" + j.id)}
                      >
                        <ReglageVolume t={t} volume={j.volume} muet={j.muet} onVolume={(v) => agir({ action: "volumeJoueur", joueurId: j.id, volume: v })} onMuet={(m) => agir({ action: "muetJoueur", joueurId: j.id, muet: m })} />
                      </Accordeon>
                    ))}
                  </section>
                </div>
              </div>

              <div className="musique-pied">
                <button
                  type="button"
                  className="admin-icon-btn danger"
                  disabled={occupe}
                  onClick={() => (deliageConfirme ? delier() : setDeliageConfirme(true))}
                  onBlur={() => setDeliageConfirme(false)}
                >
                  {deliageConfirme ? t("Confirmer : délier Sonos") : t("Délier mon compte Sonos")}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
