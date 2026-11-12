"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import SimpleSelect from "@/components/SimpleSelect";
import { CATEGORIES_INTEGRATIONS } from "@/lib/integrationsCatalogue";
import { ETIQUETTES_STATUT, FICHE_VIDE, PERMISSIONS_APP, REGLES_PAGE, lireIcone, verifierFiche } from "@/lib/appsDeveloppeur";
import ApercuPageApp from "@/components/ApercuPageApp";

const CHAMPS = [
  "nom",
  "description_courte",
  "description_longue",
  "icone",
  "categorie",
  "url_service",
  "url_retour",
  "url_page",
  "permissions",
  "courriel_support",
  "url_confidentialite",
  "payant",
  "prix",
];

// Espace développeur (comptes approuvés) : liste des apps et fiche d'app.
export default function TableauDeveloppeur() {
  const { t } = useT();
  const [userId, setUserId] = useState(null);
  const [apps, setApps] = useState(null);
  const [edition, setEdition] = useState(null); // null | { id?: string, fiche, note_refus?, statut? }
  const [msg, setMsg] = useState(null);

  async function charger(id) {
    const { data } = await supabase.from("apps_developpeur").select("*").eq("proprietaire_id", id).order("created_at", { ascending: false });
    setApps(data || []);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setUserId(session.user.id);
      charger(session.user.id);
    });
  }, []);

  function ouvrir(app) {
    setMsg(null);
    if (!app) return setEdition({ fiche: { ...FICHE_VIDE } });
    const fiche = {};
    for (const c of CHAMPS) fiche[c] = app[c] ?? FICHE_VIDE[c];
    fiche.regles_page = !!app.regles_page_le;
    setEdition({ id: app.id, fiche, statut: app.statut, note_refus: app.note_refus, secret: app.secret_page, aPage: !!app.url_page });
  }

  const [retrait, setRetrait] = useState(null); // { app, installations }

  async function appelerApi(action, id) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/developpeur/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action, id }),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? json : null;
  }

  async function demanderRetrait(app) {
    setMsg(null);
    const json = await appelerApi("compter", app.id);
    setRetrait({ app, installations: json ? json.installations : 0 });
  }

  async function confirmerRetrait() {
    const json = await appelerApi("retirer", retrait.app.id);
    setRetrait(null);
    if (!json) setMsg({ type: "err", text: t("Suppression impossible.") });
    else charger(userId);
  }

  if (edition) {
    return (
      <FicheApp
        edition={edition}
        userId={userId}
        onRetour={() => setEdition(null)}
        onEnregistre={() => {
          setEdition(null);
          charger(userId);
        }}
      />
    );
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>{t("Espace développeur")}</h2>
        <button type="button" className="submit-btn" onClick={() => ouvrir(null)}>
          {t("Créer une app")}
        </button>
      </div>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      <section style={{ marginTop: "24px" }}>
        <h3>{t("Mes apps")}</h3>
        {apps === null ? (
          <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>
        ) : apps.length === 0 ? (
          <p className="panel-hint">{t("Aucune app pour l'instant.")}</p>
        ) : (
          <div className="admin-list">
            {apps.map((a) => (
              <div className="admin-row" key={a.id}>
                <div className="admin-row-main">
                  <div className="admin-row-title">{a.nom}</div>
                  <div className="admin-row-sub">{t(ETIQUETTES_STATUT[a.statut])}</div>
                </div>
                <div className="admin-row-controls">
                  <button type="button" className="admin-icon-btn" onClick={() => ouvrir(a)}>
                    {t("Modifier")}
                  </button>
                  <button type="button" className="admin-icon-btn danger" onClick={() => demanderRetrait(a)}>
                    {a.statut === "approuvee" ? t("Retirer") : t("Supprimer")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {retrait && (
        <div className="modal-overlay" onClick={() => setRetrait(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("Retirer {nom}?", { nom: retrait.app.nom })}</h3>
            </div>
            <p className="panel-hint" style={{ marginTop: 0 }}>
              {retrait.installations > 0
                ? t("{n} entreprise(s) l'ont installée. Elles la perdront.", { n: retrait.installations })
                : t("Aucune entreprise ne l'a installée.")}
            </p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button type="button" className="btn-danger" onClick={confirmerRetrait}>
                {t("Retirer l'app")}
              </button>
              <button type="button" className="admin-icon-btn" onClick={() => setRetrait(null)}>
                {t("Annuler")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FicheApp({ edition, userId, onRetour, onEnregistre }) {
  const { t } = useT();
  const [f, setF] = useState(edition.fiche);
  const [msg, setMsg] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const fichierRef = useRef(null);
  const [apercu, setApercu] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);
  const maj = (cle, valeur) => setF((x) => ({ ...x, [cle]: valeur }));

  async function choisirIcone(e) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    try {
      maj("icone", await lireIcone(fichier));
    } catch {
      setMsg({ type: "err", text: t("Image illisible.") });
    }
  }

  function basculerPermission(id) {
    maj("permissions", f.permissions.includes(id) ? f.permissions.filter((p) => p !== id) : [...f.permissions, id]);
  }

  async function enregistrer(soumettre) {
    setMsg(null);
    if (soumettre) {
      const erreur = verifierFiche(f);
      if (erreur) return setMsg({ type: "err", text: t(erreur) });
    } else if (!f.nom.trim()) {
      return setMsg({ type: "err", text: t("Le nom est requis.") });
    }
    setOccupe(true);
    const { regles_page, ...reste } = f;
    const ligne = {
      ...reste,
      url_page: f.url_page.trim() || null,
      regles_page_le: f.url_page.trim() && regles_page ? new Date().toISOString() : null,
      prix: f.payant ? f.prix.trim() : null,
      statut: soumettre ? "soumise" : "brouillon",
      note_refus: null,
      updated_at: new Date().toISOString(),
    };
    // Brouillon : les champs obligatoires de la base reçoivent une valeur vide plutôt que de bloquer l'enregistrement.
    for (const c of ["description_courte", "url_service", "url_retour", "courriel_support", "url_confidentialite"]) ligne[c] = ligne[c] || "";
    const { error } = edition.id
      ? await supabase.from("apps_developpeur").update(ligne).eq("id", edition.id)
      : await supabase.from("apps_developpeur").insert({ ...ligne, proprietaire_id: userId });
    setOccupe(false);
    if (error) return setMsg({ type: "err", text: t("L'enregistrement a échoué.") });
    onEnregistre();
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      <button type="button" className="admin-icon-btn" onClick={onRetour}>
        ← {t("Retour")}
      </button>
      <h2 style={{ marginTop: "16px" }}>{edition.id ? t("Modifier l'app") : t("Nouvelle app")}</h2>
      {edition.statut === "refusee" && edition.note_refus && <p className="settings-msg err">{edition.note_refus}</p>}
      {edition.statut === "approuvee" && <p className="panel-hint">{t("Modifier une app approuvée la renvoie en révision.")}</p>}

      <div className="avatar-upload" style={{ marginTop: "16px" }}>
        <div className="avatar-preview">{f.icone ? <img src={f.icone} alt="" /> : "?"}</div>
        <div className="avatar-actions">
          <button type="button" className="btn-small" onClick={() => fichierRef.current?.click()}>
            {t("Choisir l'icône")}
          </button>
          <input ref={fichierRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={choisirIcone} />
        </div>
      </div>

      <div className="field">
        <label>{t("Nom de l'app")}</label>
        <input type="text" value={f.nom} onChange={(e) => maj("nom", e.target.value)} maxLength={60} />
      </div>
      <div className="field">
        <label>{t("Catégorie")}</label>
        <SimpleSelect options={CATEGORIES_INTEGRATIONS} value={f.categorie} onChange={(v) => maj("categorie", v)} />
      </div>
      <div className="field">
        <label>{t("Description courte")}</label>
        <input type="text" value={f.description_courte} onChange={(e) => maj("description_courte", e.target.value)} maxLength={120} />
      </div>
      <div className="field">
        <label>{t("Description longue")}</label>
        <textarea rows={5} value={f.description_longue} onChange={(e) => maj("description_longue", e.target.value)} maxLength={2000} />
      </div>
      <div className="field">
        <label>{t("Adresse du service")}</label>
        <input type="url" value={f.url_service} onChange={(e) => maj("url_service", e.target.value)} placeholder="https://" />
      </div>
      <div className="field">
        <label>{t("Adresse de retour de connexion")}</label>
        <input type="url" value={f.url_retour} onChange={(e) => maj("url_retour", e.target.value)} placeholder="https://" />
      </div>

      <div className="field">
        <label>{t("Page de gestion de l'app (facultatif)")}</label>
        <input type="url" value={f.url_page} onChange={(e) => maj("url_page", e.target.value)} placeholder="https://" />
        {f.url_page.trim() && (
          <div style={{ marginTop: "10px", fontSize: "13.5px" }}>
            <strong>{t("Règles de la page")}</strong>
            <ul style={{ margin: "6px 0 10px 18px", display: "grid", gap: "4px" }}>
              {REGLES_PAGE.map((r) => (
                <li key={r}>{t(r)}</li>
              ))}
            </ul>
            <label style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <input type="checkbox" checked={f.regles_page} onChange={(e) => maj("regles_page", e.target.checked)} style={{ marginTop: "3px" }} />
              {t("Ma page respecte ces règles. Je comprends qu'elle sera vérifiée avant l'approbation.")}
            </label>
            {edition.id && edition.aPage && (
              <button type="button" className="admin-icon-btn" style={{ marginTop: "10px" }} onClick={() => setApercu(true)}>
                {t("Aperçu de ma page")}
              </button>
            )}
            {edition.secret && (
              <p style={{ marginTop: "12px" }}>
                {t("Chaque ouverture reçoit un paramètre « jeton » (JWT HS256, valide 5 minutes) signé avec cette clé. Vérifie-le avant d'afficher quoi que ce soit.")}
                <br />
                <button type="button" className="admin-icon-btn" onClick={() => setSecretVisible((v) => !v)} style={{ marginTop: "6px" }}>
                  {secretVisible ? t("Masquer la clé") : t("Afficher la clé de signature")}
                </button>
                {secretVisible && <code style={{ display: "block", marginTop: "6px", wordBreak: "break-all" }}>{edition.secret}</code>}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="field">
        <label>{t("Permissions demandées")}</label>
        {PERMISSIONS_APP.map((m) => (
          <div key={m.module} style={{ margin: "8px 0" }}>
            <strong style={{ fontSize: "13.5px" }}>{t(m.label)}</strong>
            {m.actions.map((a) => (
              <label key={a.id} style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13.5px", margin: "4px 0" }}>
                <input type="checkbox" checked={f.permissions.includes(a.id)} onChange={() => basculerPermission(a.id)} />
                {t(a.label)}
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="field">
        <label>{t("Courriel de support")}</label>
        <input type="email" value={f.courriel_support} onChange={(e) => maj("courriel_support", e.target.value)} />
      </div>
      <div className="field">
        <label>{t("Politique de confidentialité")}</label>
        <input type="url" value={f.url_confidentialite} onChange={(e) => maj("url_confidentialite", e.target.value)} placeholder="https://" />
      </div>

      <div className="field">
        <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input type="checkbox" checked={f.payant} onChange={(e) => maj("payant", e.target.checked)} />
          {t("App payante (tu factures toi-même)")}
        </label>
        {f.payant && <input type="text" value={f.prix} onChange={(e) => maj("prix", e.target.value)} placeholder={t("Prix")} maxLength={80} />}
      </div>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
        <button type="button" className="submit-btn" disabled={occupe} onClick={() => enregistrer(true)}>
          {t("Soumettre")}
        </button>
        <button type="button" className="admin-icon-btn" disabled={occupe} onClick={() => enregistrer(false)}>
          {t("Enregistrer le brouillon")}
        </button>
      </div>

      {apercu && (
        <ApercuPageApp
          titre={f.nom || t("Aperçu de ma page")}
          t={t}
          onFermer={() => setApercu(false)}
          charger={async (theme, accent, lang) => {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch("/api/developpeur/apps", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
              body: JSON.stringify({ action: "apercu", id: edition.id, theme, accent, lang }),
            });
            const json = await res.json().catch(() => ({}));
            return res.ok ? json.url : null;
          }}
        />
      )}
    </div>
  );
}
