"use client";

import { useEffect, useRef, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";
import { IconFlecheDroite, IconFlecheGauche } from "@/components/icons/Pictogrammes";

function dateAujourdhui() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}

// Les téléphones se resynchronisent tout seuls à cet intervalle tant que la page est visible.
const INTERVALLE_RAFRAICHISSEMENT_MS = 15000;

function decalerJour(date, delta) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export default function TachesEmploye() {
  const { t, langue } = useLangue();
  const [date, setDate] = useState(dateAujourdhui);
  const [taches, setTaches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [popupOuvert, setPopupOuvert] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouvelleCategorie, setNouvelleCategorie] = useState("");
  const [nouvelEmplacement, setNouvelEmplacement] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const [erreurCoche, setErreurCoche] = useState(false);
  // Cases cochées/décochées dont l'envoi au serveur n'est pas terminé : un
  // rafraîchissement ne doit pas les écraser avec l'ancienne valeur.
  const enAttenteRef = useRef(new Map());

  // Relit les tâches du jour affiché. En mode silencieux (rafraîchissement
  // automatique) : pas de "Chargement...", et on garde l'état des cases dont
  // l'envoi est en cours.
  async function charger({ silencieux = false } = {}) {
    try {
      const res = await employeFetch(`/api/employe-app/taches?date=${date}`);
      const data = await res.json();
      const recues = (data.taches || []).map((tk) =>
        enAttenteRef.current.has(tk.id) ? { ...tk, terminee: enAttenteRef.current.get(tk.id) } : tk
      );
      setTaches(recues);
      setCategories(data.categories || []);
      setEmplacements(data.emplacements || []);
    } catch {
      // Échec silencieux : on garde ce qui est affiché, le prochain cycle réessaiera.
    }
    if (!silencieux) setLoading(false);
  }

  // Au changement de jour : chargement complet, puis rafraîchissement automatique
  // (toutes les 15 s et dès que l'app revient au premier plan) pour que tous les
  // téléphones voient ce que les collègues ont coché.
  useEffect(() => {
    setLoading(true);
    charger();

    const id = setInterval(() => {
      if (document.visibilityState === "visible") charger({ silencieux: true });
    }, INTERVALLE_RAFRAICHISSEMENT_MS);
    const auRetour = () => {
      if (document.visibilityState === "visible") charger({ silencieux: true });
    };
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("focus", auRetour);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("focus", auRetour);
    };
  }, [date]);

  async function toggle(tache) {
    const nouvelleValeur = !tache.terminee;
    enAttenteRef.current.set(tache.id, nouvelleValeur);
    setErreurCoche(false);
    setTaches((prev) => prev.map((tk) => (tk.id === tache.id ? { ...tk, terminee: nouvelleValeur } : tk)));

    let ok = false;
    try {
      const res = await employeFetch(`/api/employe-app/taches/${tache.id}`, {
        method: "PATCH",
        body: JSON.stringify({ terminee: nouvelleValeur }),
      });
      ok = res.ok;
    } catch {}

    enAttenteRef.current.delete(tache.id);

    if (!ok) {
      // L'envoi a échoué (réseau coupé, session expirée...) : on remet la case
      // dans son vrai état au lieu de laisser croire que c'est enregistré.
      setTaches((prev) => prev.map((tk) => (tk.id === tache.id ? { ...tk, terminee: tache.terminee } : tk)));
      setErreurCoche(true);
    }
  }

  function ouvrirPopup() {
    setNouveauNom("");
    setNouvelleCategorie("");
    setNouvelEmplacement(emplacements[0]?.id || "");
    setErreur("");
    setPopupOuvert(true);
  }

  async function ajouter(e) {
    e.preventDefault();
    if (!nouveauNom.trim() || busy) return;
    setBusy(true);
    setErreur("");
    const res = await employeFetch("/api/employe-app/taches", {
      method: "POST",
      body: JSON.stringify({
        texte: nouveauNom.trim(),
        categorie_id: nouvelleCategorie || null,
        emplacement_id: nouvelEmplacement || null,
        date,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.tache) {
      setErreur(data.error || t("taches.erreur"));
      return;
    }
    setTaches((prev) => [...prev, data.tache]);
    setPopupOuvert(false);
  }

  const aujourdhui = dateAujourdhui();
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(langue === "en" ? "en-CA" : "fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const groupes = [];
  const parCategorie = new Map();
  for (const tache of taches) {
    const cle = tache.categorie?.id || "sans-categorie";
    if (!parCategorie.has(cle)) {
      parCategorie.set(cle, []);
      groupes.push({ id: cle, nom: tache.categorie?.nom || t("taches.autres") });
    }
    parCategorie.get(cle).push(tache);
  }

  // Catégories dans l'ordre choisi par le gestionnaire ("Autres" / sans catégorie en dernier).
  groupes.sort((a, b) => {
    const ordre = (g) => (g.id === "sans-categorie" ? Infinity : categories.find((c) => c.id === g.id)?.ordre ?? Infinity);
    return ordre(a) - ordre(b);
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <h2 style={{ margin: 0 }}>{t("taches.titre")}</h2>
        {emplacements.length > 0 && (
          <button type="button" className="btn-small" onClick={ouvrirPopup}>
            + {t("taches.ajouter")}
          </button>
        )}
      </div>
      <p className="panel-hint">{t("taches.hint")}</p>
      {erreurCoche && <p style={{ color: "var(--danger, #ff6b6b)", fontSize: "13px", marginTop: "-14px" }}>{t("taches.erreurCoche")}</p>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "14px" }}>
        <button
          type="button"
          className="admin-icon-btn"
          aria-label={t("taches.jourPrecedent")}
          onClick={() => setDate((d) => decalerJour(d, -1))}
        >
          <IconFlecheGauche className="gozly-icon" />
        </button>
        <div style={{ textAlign: "center" }}>
          <div className="planning-day-title" style={{ textTransform: "capitalize" }}>
            {dateLabel}
          </div>
          {date !== aujourdhui && (
            <button
              type="button"
              className="admin-icon-btn"
              style={{ marginTop: "6px" }}
              onClick={() => setDate(aujourdhui)}
            >
              {t("taches.aujourdhui")}
            </button>
          )}
        </div>
        <button
          type="button"
          className="admin-icon-btn"
          aria-label={t("taches.jourSuivant")}
          onClick={() => setDate((d) => decalerJour(d, 1))}
        >
          <IconFlecheDroite className="gozly-icon" />
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>{t("nav.chargement")}</p>
      ) : taches.length === 0 ? (
        <p className="chat-empty">{t("taches.aucune")}</p>
      ) : (
        <div className="planning-days">
          {groupes.map((cat) => (
            <div className="planning-day" key={cat.id}>
              <div className="planning-day-head">
                <span className="planning-day-title">{cat.nom}</span>
              </div>
              {parCategorie.get(cat.id).map((tache) => (
                <label className="planning-tache" key={tache.id}>
                  <input type="checkbox" checked={tache.terminee} onChange={() => toggle(tache)} />
                  <span className={`planning-tache-texte${tache.terminee ? " done" : ""}`}>{tache.texte}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      {popupOuvert && (
        <div className="modal-overlay" onClick={() => setPopupOuvert(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("taches.ajouterTitre")}</h3>
            </div>
            <form onSubmit={ajouter}>
              <div className="field">
                <label>{t("taches.categorie")}</label>
                <select value={nouvelleCategorie} onChange={(e) => setNouvelleCategorie(e.target.value)}>
                  <option value="">{t("taches.sansCategorie")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </div>
              {emplacements.length > 1 && (
                <div className="field">
                  <label>{t("taches.succursale")}</label>
                  <select value={nouvelEmplacement} onChange={(e) => setNouvelEmplacement(e.target.value)}>
                    {emplacements.map((em) => (
                      <option key={em.id} value={em.id}>
                        {em.nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label>{t("taches.nom")}</label>
                <input
                  type="text"
                  value={nouveauNom}
                  onChange={(e) => setNouveauNom(e.target.value)}
                  placeholder={t("taches.nomPlaceholder")}
                  maxLength={200}
                  autoFocus
                  required
                />
              </div>
              {erreur && <p style={{ color: "var(--danger, #ff6b6b)", fontSize: "13px" }}>{erreur}</p>}
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button type="button" className="admin-icon-btn" onClick={() => setPopupOuvert(false)}>
                  {t("pointage.annuler")}
                </button>
                <button type="submit" className="btn-small" disabled={busy || !nouveauNom.trim()}>
                  {t("taches.ajouter")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
