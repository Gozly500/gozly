"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import Gozyx from "@/components/Gozyx";
import { IconEtatFonctionne, IconEtatProbleme, IconEtatNonFonctionnel } from "@/components/icons/GozlyIcons";

const ETATS = {
  ok: { couleur: "#34d399" },
  probleme: { couleur: "#fbbf24" },
  panne: { couleur: "#f87171" },
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
  const { t, lang } = useT();
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
        <p className="statut-chargement">{erreur ? t("statut.erreurChargement") : t("statut.chargement")}</p>
      </div>
    );
  }

  return (
    <div className="wrap statut-wrap">
      {/* Gozyx réagit à l'état global : tranquille, inquiet ou affolé. */}
      <div className="statut-gozyx">
        <Gozyx humeur={statut.global === "ok" ? "normal" : statut.global} taille={130} />
      </div>

      <div className={`statut-banniere statut-${statut.global}`}>
        <IconeEtat etat={statut.global} className="statut-icone-grande" />
        <div>
          <strong>{t("statut.global." + statut.global)}</strong>
          <small>
            {t("statut.verifieA")}{" "}
            {new Date(statut.verifieA).toLocaleTimeString(lang === "en" ? "en-CA" : "fr-CA", { hour: "2-digit", minute: "2-digit" })}
            {" · "}{t("statut.maj")}
          </small>
        </div>
      </div>

      <div className="statut-bento">
        {statut.groupes.map((g) => (
          <section key={g.id} className={`statut-carte statut-carte-${g.id}`}>
            <h2>{t("statut.groupe." + g.id)}</h2>
            <ul>
              {g.systemes.map((s) => (
                <li key={s.cle} className="statut-ligne">
                  <div className="statut-ligne-haut">
                    <IconeEtat etat={s.etat} />
                    <span className="statut-nom">{t("statut.sys." + s.cle)}</span>
                    <span className={`statut-etat statut-texte-${s.etat}`}>{t("statut." + s.etat)}</span>
                    {admin && (
                      <button type="button" className="statut-modifier" onClick={() => (edition === s.cle ? setEdition(null) : ouvrirEdition(s))}>
                        {t("statut.modifier")}
                      </button>
                    )}
                  </div>
                  {s.message && <p className="statut-message">{s.message}</p>}

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
                            {t("statut." + id)}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        maxLength={300}
                        placeholder={t("statut.msgPh")}
                        value={brouillon.message}
                        onChange={(e) => setBrouillon((b) => ({ ...b, message: e.target.value }))}
                      />
                      {erreurEdition && <p className="statut-erreur">{erreurEdition}</p>}
                      <div className="statut-actions">
                        <button type="button" className="statut-btn-principal" disabled={enregistrement} onClick={() => enregistrer(s.cle, brouillon.etat)}>
                          {enregistrement ? t("statut.enregistrement") : t("statut.enregistrer")}
                        </button>
                        {s.manuel && (
                          <button type="button" className="statut-btn-secondaire" disabled={enregistrement} onClick={() => enregistrer(s.cle, null)}>
                            {t("statut.auto")}
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
