"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { IconEtatFonctionne, IconEtatProbleme, IconEtatNonFonctionnel } from "@/components/icons/GozlyIcons";

const ETATS = {
  ok: { label: "Fonctionne", couleur: "#34d399" },
  probleme: { label: "Problème", couleur: "#fbbf24" },
  panne: { label: "Ne fonctionne pas", couleur: "#f87171" },
};

const TITRE_GLOBAL = {
  ok: "Tous les systèmes fonctionnent",
  probleme: "Certains systèmes ont un problème",
  panne: "Certains systèmes ne fonctionnent pas",
};

const ICONES = { ok: IconEtatFonctionne, probleme: IconEtatProbleme, panne: IconEtatNonFonctionnel };

function IconeEtat({ etat, className = "" }) {
  const Icone = ICONES[etat];
  return <Icone className={`statut-icone statut-icone-${etat} ${className}`} aria-hidden="true" />;
}

async function tokenAdmin() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export default function StatutContent() {
  const tokenRef = useRef(null);
  const [statut, setStatut] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [edition, setEdition] = useState(null); // clé du système en cours de modification
  const [brouillon, setBrouillon] = useState({ etat: "ok", message: "" });
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurEdition, setErreurEdition] = useState("");

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/statut", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setStatut(await res.json());
      setErreur(false);
    } catch {
      setErreur(true);
    }
  }, []);

  useEffect(() => {
    charger();
    const id = setInterval(charger, 60000);
    return () => clearInterval(id);
  }, [charger]);

  useEffect(() => {
    (async () => {
      const token = await tokenAdmin();
      if (!token) return;
      tokenRef.current = token;
      const res = await fetch("/api/admin/statut", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAdmin((await res.json()).admin === true);
    })();
  }, []);

  function ouvrirEdition(s) {
    setEdition(s.cle);
    setErreurEdition("");
    setBrouillon({ etat: s.etat, message: s.message || "" });
  }

  async function enregistrer(cle, etat) {
    setEnregistrement(true);
    setErreurEdition("");
    try {
      // getSession peut rester bloqué (verrou d'auth) : on retombe sur le jeton lu au chargement.
      const token = await Promise.race([
        tokenAdmin(),
        new Promise((resolve) => setTimeout(() => resolve(tokenRef.current), 3000)),
      ]);
      if (!token) {
        setErreurEdition("Session introuvable : reconnecte-toi puis réessaie.");
        return;
      }
      const res = await fetch("/api/admin/statut", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cle, etat, message: brouillon.message }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErreurEdition(`Erreur ${res.status} : ${json.error || "échec de l'enregistrement."}`);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setEdition(null);
      charger();
    } catch (e) {
      setErreurEdition(`Erreur réseau : ${e.message}`);
    } finally {
      setEnregistrement(false);
    }
  }

  if (!statut) {
    return (
      <div className="wrap statut-wrap">
        <p className="statut-chargement">{erreur ? "Impossible de charger le statut pour l'instant." : "Vérification en cours..."}</p>
      </div>
    );
  }

  return (
    <div className="wrap statut-wrap">
      <div className={`statut-banniere statut-${statut.global}`}>
        <IconeEtat etat={statut.global} className="statut-icone-grande" />
        <div>
          <strong>{TITRE_GLOBAL[statut.global]}</strong>
          <small>
            Vérifié à{" "}
            {new Date(statut.verifieA).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
            {" · "}mis à jour automatiquement chaque minute
          </small>
        </div>
      </div>

      <div className="statut-bento">
        {statut.groupes.map((g) => (
          <section key={g.id} className={`statut-carte statut-carte-${g.id}`}>
            <h2>{g.titre}</h2>
            <ul>
              {g.systemes.map((s) => (
                <li key={s.cle} className="statut-ligne">
                  <div className="statut-ligne-haut">
                    <IconeEtat etat={s.etat} />
                    <span className="statut-nom">{s.nom}</span>
                    <span className={`statut-etat statut-texte-${s.etat}`}>{ETATS[s.etat].label}</span>
                    {admin && (
                      <button type="button" className="statut-modifier" onClick={() => (edition === s.cle ? setEdition(null) : ouvrirEdition(s))}>
                        Modifier
                      </button>
                    )}
                  </div>
                  {s.message && <p className="statut-message">{s.message}</p>}
                  {admin && s.manuel && <p className="statut-manuel">Modifié manuellement (détecté : {ETATS[s.auto].label})</p>}

                  {admin && edition === s.cle && (
                    <div className="statut-edition">
                      <div className="statut-choix">
                        {Object.entries(ETATS).map(([id, e]) => (
                          <button
                            key={id}
                            type="button"
                            className={brouillon.etat === id ? "actif" : ""}
                            style={brouillon.etat === id ? { borderColor: e.couleur, color: e.couleur } : undefined}
                            onClick={() => setBrouillon((b) => ({ ...b, etat: id }))}
                          >
                            {e.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        maxLength={300}
                        placeholder="Message pour les clients (facultatif)"
                        value={brouillon.message}
                        onChange={(e) => setBrouillon((b) => ({ ...b, message: e.target.value }))}
                      />
                      {erreurEdition && <p className="statut-erreur">{erreurEdition}</p>}
                      <div className="statut-actions">
                        <button type="button" className="statut-btn-principal" disabled={enregistrement} onClick={() => enregistrer(s.cle, brouillon.etat)}>
                          {enregistrement ? "Enregistrement..." : "Enregistrer"}
                        </button>
                        {s.manuel && (
                          <button type="button" className="statut-btn-secondaire" disabled={enregistrement} onClick={() => enregistrer(s.cle, null)}>
                            Revenir à l'automatique
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
