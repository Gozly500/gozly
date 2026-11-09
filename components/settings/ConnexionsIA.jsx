"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { IconFlecheBas } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";

async function appeler(corps) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/ia/cles", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token}` },
    body: JSON.stringify(corps),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });
}

// Connexion d'un assistant IA (ChatGPT, Claude...) à l'entreprise. Le plus simple : le client ajoute l'adresse du connecteur dans
// son assistant et clique « Autoriser » dans la fenêtre Gozly (OAuth). Une clé manuelle reste possible (section « Avancé »).
// Ce que l'IA peut faire est réglé dans PermissionsIA (permissions de l'entreprise, valables pour toutes les connexions).
export default function ConnexionsIA({ entrepriseId }) {
  const { t } = useT();
  const [etat, setEtat] = useState("chargement"); // chargement | pret | refuse | nonConfigure
  const [cles, setCles] = useState([]);
  const [nom, setNom] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState(null);
  const [nouvelleCle, setNouvelleCle] = useState(null);
  const [copie, setCopie] = useState("");
  const [journalOuvert, setJournalOuvert] = useState(null);
  const [journal, setJournal] = useState([]);
  const [avance, setAvance] = useState(false);

  const adresse = typeof window !== "undefined" ? `${window.location.origin}/api/ia/mcp` : "/api/ia/mcp";

  useEffect(() => {
    if (entrepriseId) charger();
  }, [entrepriseId]);

  async function charger() {
    const { ok, status, data } = await appeler({ action: "lister", entrepriseId });
    if (status === 403) return setEtat("refuse");
    if (!ok) return setEtat("pret");
    setCles(data.cles || []);
    setEtat(data.configure === false ? "nonConfigure" : "pret");
  }

  async function creer(e) {
    e.preventDefault();
    setOccupe(true);
    setMsg(null);
    const { ok, data } = await appeler({ action: "creer", entrepriseId, nom });
    setOccupe(false);
    if (!ok) return setMsg({ type: "err", text: data.error || t("Échec") });
    setNouvelleCle(data.cle);
    setNom("");
    charger();
  }

  async function revoquer(cle) {
    if (!window.confirm(t("Révoquer « {nom} » ? L'assistant branché avec cette clé perdra l'accès tout de suite.", { nom: cle.nom }))) return;
    const { ok, data } = await appeler({ action: "revoquer", entrepriseId, cleId: cle.id });
    if (!ok) return setMsg({ type: "err", text: data.error || t("Échec") });
    if (journalOuvert === cle.id) setJournalOuvert(null);
    charger();
  }

  async function basculerJournal(cle) {
    if (journalOuvert === cle.id) return setJournalOuvert(null);
    setJournalOuvert(cle.id);
    setJournal([]);
    const { data } = await appeler({ action: "journal", entrepriseId, cleId: cle.id });
    setJournal(data.journal || []);
  }

  async function copier(texte, id) {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(id);
      setTimeout(() => setCopie(""), 1800);
    } catch {
      /* le texte reste sélectionnable à la main */
    }
  }

  if (etat === "chargement") return <p className="section-hint">{t("Chargement...")}</p>;
  if (etat === "refuse") return <p className="section-hint">{t("Seul le propriétaire de l'entreprise peut gérer les connexions IA.")}</p>;
  if (etat === "nonConfigure") return <p className="section-hint">{t("Cette fonction n'est pas encore activée sur ton compte. Contacte le support Gozly.")}</p>;

  return (
    <div className="integration-item">
      <div className="integration-header open">
        <span className="ih-label">{t("Assistants IA (ChatGPT, Claude...)")}</span>
      </div>
      <div className="integration-body">
        <p className="section-hint">
          {t("Branche l'assistant IA de ton choix à ton entreprise. Ce qu'il peut faire (horaire, planning, inventaire, ventes...) se règle dans « Permissions de l'IA », juste en dessous. Il n'agit que sur ta demande.")}
        </p>

        <div className="abo-carte" style={{ marginTop: "12px" }}>
          <strong>{t("Comment le connecter")}</strong>
          <ol style={{ margin: "0 0 0 18px", display: "grid", gap: "4px" }}>
            <li>{t("Copie l'adresse ci-dessous.")}</li>
            <li>{t("Dans ton assistant (ChatGPT, Claude...), ajoute un connecteur personnalisé et colle l'adresse.")}</li>
            <li>{t("Une fenêtre Gozly s'ouvre : clique « Autoriser ».")}</li>
          </ol>
          <code style={{ wordBreak: "break-all", userSelect: "all" }}>{adresse}</code>
          <div className="abo-actions">
            <button type="button" className="admin-icon-btn" onClick={() => copier(adresse, "adresse")}>
              {copie === "adresse" ? t("Copié") : t("Copier l'adresse")}
            </button>
          </div>
        </div>

        {cles.length > 0 && (
          <div style={{ marginTop: "14px" }}>
            <strong>{t("Connexions actives")}</strong>
            {cles.map((c) => (
              <div key={c.id} className="abo-carte" style={{ marginTop: "8px", padding: "12px 16px" }}>
                <div className="abo-tete">
                  <strong>{c.oauth ? c.client_nom || c.nom : c.nom}</strong>
                  {c.oauth ? <span className="admin-status-pill">{t("Autorisée")}</span> : <code className="abo-id">{c.prefixe}…</code>}
                </div>
                <div className="section-hint" style={{ margin: 0 }}>
                  {c.derniere_utilisation ? t("Dernière utilisation : {date}", { date: formatDate(c.derniere_utilisation) }) : t("Jamais utilisée")}
                </div>
                <div className="abo-actions">
                  <button type="button" className="admin-icon-btn" onClick={() => basculerJournal(c)}>
                    {journalOuvert === c.id ? t("Masquer l'activité") : t("Voir l'activité")}
                  </button>
                  <button type="button" className="admin-icon-btn danger" onClick={() => revoquer(c)}>
                    {t("Révoquer")}
                  </button>
                </div>
                {journalOuvert === c.id && (
                  <div>
                    {journal.length === 0 && <p className="section-hint" style={{ margin: 0 }}>{t("Aucune activité pour l'instant.")}</p>}
                    {journal.map((j) => (
                      <div key={j.id} className="abo-cle">
                        <code>{j.outil}</code>
                        <span className={`abo-prix${j.ok ? "" : " manquant"}`}>{j.resume || ""}</span>
                        <span className="abo-periode">{formatDate(j.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

        <div style={{ marginTop: "18px" }}>
          <button type="button" className="outils-support-toggle" aria-expanded={avance} onClick={() => setAvance((v) => !v)}>
            {t("Avancé : clé d'accès manuelle")}
            <span className={`param-nav-fleche${avance ? " ouvert" : ""}`}>
              <IconFlecheBas className="gozly-icon-inline" />
            </span>
          </button>
          {avance && (
            <div className="outils-support-corps">
              <p className="section-hint">
                {t("Pour un assistant qui ne gère pas le bouton « Autoriser » : une clé à coller dans le connecteur, en en-tête « Authorization: Bearer ta-clé ». Si l'assistant ne permet pas d'en-tête, ajoute la clé à la fin de l'adresse : …/api/ia/mcp?cle=ta-clé (moins sûr : une adresse peut se retrouver dans des journaux).")}
              </p>

              {nouvelleCle && (
                <div className="abo-carte" style={{ marginBottom: "12px" }}>
                  <strong>{t("Ta clé (affichée une seule fois)")}</strong>
                  <code style={{ wordBreak: "break-all", userSelect: "all" }}>{nouvelleCle}</code>
                  <div className="abo-actions">
                    <button type="button" className="admin-icon-btn" onClick={() => copier(nouvelleCle, "cle")}>
                      {copie === "cle" ? t("Copié") : t("Copier la clé")}
                    </button>
                    <button type="button" className="admin-icon-btn" onClick={() => setNouvelleCle(null)}>
                      {t("J'ai copié ma clé")}
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={creer}>
                <div className="field">
                  <label>{t("Nom de la clé")}</label>
                  <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t("ex: ChatGPT de Marie")} maxLength={60} />
                </div>
                <button type="submit" className="submit-btn" disabled={occupe || !nom.trim()}>
                  {occupe ? "..." : t("Créer une clé")}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
