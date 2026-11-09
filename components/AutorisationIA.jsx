"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import SimpleSelect from "@/components/SimpleSelect";
import SelecteurDroitsIA from "@/components/SelecteurDroitsIA";
import { aAuMoinsUnDroit, DROITS_PAR_DEFAUT } from "@/lib/iaModules";

async function appeler(corps) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/ia/oauth/approuver", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token}` },
    body: JSON.stringify(corps),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, data: json };
}

// Page d'autorisation OAuth : l'assistant IA (ChatGPT, Claude...) y envoie le propriétaire, qui se connecte à Gozly,
// choisit l'entreprise et ce que l'assistant a le droit de faire, puis autorise (ou refuse).
export default function AutorisationIA() {
  const router = useRouter();
  const [params, setParams] = useState(null);
  const [etat, setEtat] = useState("chargement"); // chargement | pret | invalide | aucuneEntreprise | termine
  const [infos, setInfos] = useState(null);
  const [entrepriseId, setEntrepriseId] = useState("");
  const [droits, setDroits] = useState(DROITS_PAR_DEFAUT);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = {
      client_id: q.get("client_id"),
      redirect_uri: q.get("redirect_uri"),
      code_challenge: q.get("code_challenge"),
      code_challenge_method: q.get("code_challenge_method"),
      state: q.get("state"),
    };
    if (!p.client_id || !p.redirect_uri || !p.code_challenge || q.get("response_type") !== "code") {
      setEtat("invalide");
      return;
    }
    setParams(p);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        // Pas connecté : on passe par la connexion Gozly, qui nous ramène ici avec les mêmes paramètres.
        router.replace(`/login?retour=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      const { ok, data } = await appeler({ action: "infos", ...p });
      if (!ok) {
        setErreur(data.error || "");
        setEtat("invalide");
        return;
      }
      setInfos(data);
      if (!data.entreprises?.length) {
        setEtat("aucuneEntreprise");
        return;
      }
      setEntrepriseId(data.entreprises[0].id);
      setEtat("pret");
    });
  }, [router]);

  async function decider(autoriser) {
    setOccupe(true);
    setErreur("");
    const { ok, data } = await appeler(
      autoriser ? { action: "autoriser", ...params, entrepriseId, droits } : { action: "refuser", ...params }
    );
    if (!ok || !data.redirect) {
      setOccupe(false);
      setErreur(data.error || "Échec. Réessaie.");
      return;
    }
    setEtat("termine");
    window.location.href = data.redirect;
  }

  if (etat === "chargement") return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;

  if (etat === "invalide") {
    return (
      <div>
        <p className="settings-msg err">{erreur || "Cette demande de connexion est invalide ou incomplète."}</p>
        <p className="section-hint">Reviens dans ton assistant IA et relance la connexion à Gozly.</p>
      </div>
    );
  }

  if (etat === "aucuneEntreprise") {
    return (
      <div>
        <p className="settings-msg err">Seul le propriétaire d'une entreprise peut y brancher un assistant IA.</p>
        <p className="section-hint">Connecte-toi avec le compte du propriétaire, puis relance la connexion depuis ton assistant.</p>
        <button type="button" className="admin-icon-btn" onClick={() => decider(false)} disabled={occupe}>
          Annuler
        </button>
      </div>
    );
  }

  if (etat === "termine") return <p style={{ color: "var(--text-dim)" }}>Retour vers ton assistant...</p>;

  return (
    <div>
      <h2 style={{ marginBottom: "6px" }}>{infos.client_nom} veut se connecter à Gozly</h2>
      <p className="section-hint">
        Tu seras renvoyé vers <strong>{infos.redirect_hote}</strong> après ta réponse. Autorise seulement si tu viens de lancer la connexion depuis cet assistant.
      </p>

      {infos.entreprises.length > 1 && (
        <div className="field">
          <label>Entreprise à connecter</label>
          <SimpleSelect options={infos.entreprises.map((e) => ({ id: e.id, label: e.nom }))} value={entrepriseId} onChange={setEntrepriseId} />
        </div>
      )}
      {infos.entreprises.length === 1 && (
        <p>
          Entreprise : <strong>{infos.entreprises[0].nom}</strong>
        </p>
      )}

      <p style={{ margin: "14px 0 8px" }}>
        <strong>Choisis ce que l'assistant peut faire, module par module :</strong>
      </p>
      <SelecteurDroitsIA droits={droits} onChange={setDroits} />

      <div className="abo-carte" style={{ margin: "14px 0" }}>
        <strong>Dans tous les cas, il ne pourra jamais :</strong>
        <ul style={{ margin: "6px 0 0 18px" }}>
          <li>publier un horaire ni envoyer de notification</li>
          <li>voir les salaires, les NIP ni les coordonnées de tes employés</li>
          <li>supprimer ce qu'un humain a créé</li>
        </ul>
      </div>

      {erreur && <p className="settings-msg err">{erreur}</p>}

      <div className="abo-actions">
        <button type="button" className="submit-btn" onClick={() => decider(true)} disabled={occupe || !entrepriseId || !aAuMoinsUnDroit(droits)}>
          {occupe ? "..." : "Autoriser"}
        </button>
        <button type="button" className="admin-icon-btn" onClick={() => decider(false)} disabled={occupe}>
          Refuser
        </button>
      </div>
      <p className="section-hint">Tu pourras révoquer l'accès à tout moment dans Paramètres › Intégrations › Intelligence artificielle.</p>
    </div>
  );
}
