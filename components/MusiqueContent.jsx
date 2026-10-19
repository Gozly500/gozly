"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashSidebar from "@/components/DashSidebar";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { sonosApi, ETATS_LECTURE } from "@/lib/sonosClient";
import SimpleSelect from "@/components/SimpleSelect";
import { useT } from "@/components/LangProvider";

const Lecture = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M8 5v14l11-7z" />
  </svg>
);
const Pause = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);
const Precedent = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M6 5h2v14H6zM20 5v14L9 12z" />
  </svg>
);
const Suivant = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M16 5h2v14h-2zM4 5l11 7-11 7z" />
  </svg>
);

// Curseur de volume : suit le doigt en local, envoie la valeur seulement quand on le relâche.
function CurseurVolume({ valeur, onValider, label }) {
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
    <label className="musique-volume">
      <span>{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={local}
        disabled={valeur == null}
        onChange={(e) => {
          glisse.current = true;
          setLocal(Number(e.target.value));
        }}
        onPointerUp={valider}
        onKeyUp={valider}
        onBlur={valider}
      />
      <strong>{local}</strong>
    </label>
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
    if (!entrepriseId) return;
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
    if (!entrepriseId) return;
    chargerEtat();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") chargerEtat();
    }, 8000);
    return () => clearInterval(id);
  }, [entrepriseId]);

  async function agir(corps) {
    setOccupe(true);
    setMessage(null);
    const r = await sonosApi("/api/sonos/commande", { method: "POST", body: { entrepriseId, ...corps } });
    if (!r.ok) setMessage({ type: "err", text: r.data?.error || t("La commande a échoué.") });
    await new Promise((res) => setTimeout(res, 800)); // Sonos met un instant à refléter le changement
    await chargerEtat();
    setOccupe(false);
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

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.entreprise || user?.email;
  const groupes = etat?.groupes || [];
  const tousJoueurs = groupes.flatMap((g) => g.joueurs.map((j) => ({ ...j, groupeId: g.id, groupeNom: g.nom })));
  const volumes = groupes.map((g) => g.volume).filter((v) => v != null);
  const volumeMoyen = volumes.length ? Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length) : null;

  return (
    <div className="dash-layout">
      <DashSidebar active="musique" displayName={displayName} userEmail={user?.email} isAdmin={isAdmin} onLogout={handleLogout} entrepriseId={entrepriseId} />

      <main className="dash-main">
        <div className="dash-main-inner">
          <header className="dash-hero-inline">
            <div>
              <h1>{t("Musique")}</h1>
              <p>{t("Contrôle ton système Sonos : lecture, volume, listes de lecture et haut-parleurs.")}</p>
            </div>
          </header>

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
              <div className="settings-section musique-global">
                <h3>{t("Tous les haut-parleurs")}</h3>
                <div className="musique-global-actions">
                  <button type="button" className="admin-icon-btn" disabled={occupe || groupes.length === 0} onClick={() => agir({ action: "toutPause" })}>
                    <Pause className="musique-picto" /> {t("Tout mettre en pause")}
                  </button>
                </div>
                <CurseurVolume valeur={volumeMoyen} label={t("Volume de tous")} onValider={(v) => agir({ action: "toutVolume", volume: v })} />
              </div>

              {groupes.length === 0 && <p className="chat-empty">{t("Aucun haut-parleur trouvé sur ce compte Sonos.")}</p>}

              {groupes.map((g) => {
                const autres = tousJoueurs.filter((j) => j.groupeId !== g.id);
                return (
                  <div className="settings-section musique-groupe" key={g.id}>
                    <div className="musique-entete">
                      {g.image && <img src={g.image} alt="" className="musique-pochette" />}
                      <div className="admin-row-main">
                        <div className="admin-row-title">{g.nom}</div>
                        <div className="admin-row-sub">
                          {t(ETATS_LECTURE[g.etat] || "Arrêté")}
                          {g.titre ? ` · ${g.titre}` : ""}
                          {g.artiste ? ` · ${g.artiste}` : ""}
                        </div>
                      </div>
                      <div className="musique-transport">
                        <button type="button" className="admin-icon-btn" disabled={occupe} onClick={() => agir({ action: "precedent", groupeId: g.id })} aria-label={t("Précédent")}>
                          <Precedent className="musique-picto" />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn musique-principal"
                          disabled={occupe}
                          onClick={() => agir({ action: g.etat === "PLAYING" ? "pause" : "lecture", groupeId: g.id })}
                          aria-label={g.etat === "PLAYING" ? t("Pause") : t("Lecture")}
                        >
                          {g.etat === "PLAYING" ? <Pause className="musique-picto" /> : <Lecture className="musique-picto" />}
                        </button>
                        <button type="button" className="admin-icon-btn" disabled={occupe} onClick={() => agir({ action: "suivant", groupeId: g.id })} aria-label={t("Suivant")}>
                          <Suivant className="musique-picto" />
                        </button>
                      </div>
                    </div>

                    <CurseurVolume valeur={g.volume} label={g.joueurs.length > 1 ? t("Volume du groupe") : t("Volume")} onValider={(v) => agir({ action: "volumeGroupe", groupeId: g.id, volume: v })} />

                    {(contenu.favoris.length > 0 || contenu.playlists.length > 0) && (
                      <div className="field-row" style={{ marginTop: "12px" }}>
                        {contenu.favoris.length > 0 && (
                          <div className="field" style={{ minWidth: "220px" }}>
                            <label>{t("Favoris Sonos")}</label>
                            <SimpleSelect
                              options={contenu.favoris.map((f) => ({ id: f.id, label: f.nom }))}
                              value={null}
                              placeholder={t("Lancer un favori...")}
                              onChange={(id) => agir({ action: "favori", groupeId: g.id, favoriId: id })}
                            />
                          </div>
                        )}
                        {contenu.playlists.length > 0 && (
                          <div className="field" style={{ minWidth: "220px" }}>
                            <label>{t("Listes de lecture")}</label>
                            <SimpleSelect
                              options={contenu.playlists.map((p) => ({ id: p.id, label: p.nom }))}
                              value={null}
                              placeholder={t("Lancer une liste...")}
                              onChange={(id) => agir({ action: "playlist", groupeId: g.id, playlistId: id })}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="musique-joueurs">
                      <div className="chat-section-label" style={{ padding: "14px 0 6px" }}>{t("Haut-parleurs")}</div>
                      {g.joueurs.map((j) => (
                        <div className="musique-joueur" key={j.id}>
                          <div className="musique-joueur-nom">{j.nom}</div>
                          <CurseurVolume valeur={j.volume} label="" onValider={(v) => agir({ action: "volumeJoueur", joueurId: j.id, volume: v })} />
                          {g.joueurs.length > 1 && (
                            <button type="button" className="admin-icon-btn" disabled={occupe} onClick={() => agir({ action: "separer", joueurId: j.id })} title={t("Lui faire jouer une autre musique")}>
                              {t("Séparer")}
                            </button>
                          )}
                        </div>
                      ))}
                      {autres.length > 0 && (
                        <div className="field" style={{ marginTop: "10px", maxWidth: "320px" }}>
                          <SimpleSelect
                            options={autres.map((j) => ({ id: j.id, label: `${j.nom} (${j.groupeNom})` }))}
                            value={null}
                            placeholder={t("Ajouter un haut-parleur à ce groupe...")}
                            onChange={(id) => agir({ action: "ajouterAuGroupe", groupeId: g.id, joueurId: id })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

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
