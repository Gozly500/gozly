"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CodeDoubleAuth from "@/components/CodeDoubleAuth";
import Link from "next/link";
import { useT } from "@/components/LangProvider";
import { genererCode, lireSecretGozly, stockerSecretGozly, effacerSecretGozly, NOM_FACTEUR_APP_GOZLY } from "@/lib/codesGozly";

// La méthode « appareil » (clé d'accès) demande que WebAuthn soit activé dans Supabase, ce qui n'est pas offert pour l'instant.
const APPAREIL_DISPONIBLE = false;

// Double authentification (une seule méthode suffit pour que le compte la demande) :
// - « App Gozly » : les codes à 6 chiffres sont dans l'app gestion (Menu > Mes codes), seulement activable depuis l'app gestion ;
// - une app d'authentification externe (Google Authenticator, Microsoft Authenticator...) ;
// - l'appareil (clé d'accès) : prêt, mais caché tant que WebAuthn n'est pas offert par Supabase.
// Si le client perd son accès, l'équipe Gozly désactive tout depuis l'administration (Clients).
export default function SecuriteGestion({ sansTitre = false, dansApp = false }) {
  const { t } = useT();
  const [methodes, setMethodes] = useState(null); // null = chargement | [{ id, type: "totp" | "webauthn", nom }]
  const [inscription, setInscription] = useState(null); // { id, qr, secret, uri } pendant l'ajout d'une app d'authentification
  const [code, setCode] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState(null);
  const [retrait, setRetrait] = useState(null); // méthode qu'on est en train de retirer
  const [cleCopiee, setCleCopiee] = useState(false);
  const [choixApp, setChoixApp] = useState(false); // choix entre « App Gozly » et une app d'authentification externe

  async function charger() {
    const { data } = await supabase.auth.mfa.listFactors();
    const verifies = (data?.all || []).filter((f) => f.status === "verified" && (f.factor_type === "totp" || f.factor_type === "webauthn"));
    setMethodes(verifies.map((f) => ({ id: f.id, type: f.factor_type, nom: f.friendly_name || "" })));
  }

  useEffect(() => {
    charger();
  }, []);

  // ----- Appareil (clé d'accès)
  async function ajouterAppareil() {
    setMsg(null);
    setOccupe(true);
    const nom = (navigator.userAgentData?.platform || navigator.platform || "Appareil").toString().slice(0, 30);
    const { error } = await supabase.auth.mfa.webauthn.register({ friendlyName: `${nom} ${new Date().toLocaleDateString("fr-CA")}` });
    setOccupe(false);
    if (error) {
      // Fenêtre fermée / refusée : pas une vraie erreur ; sinon le plus souvent WebAuthn n'est pas activé dans Supabase.
      const annule = /NotAllowed|abort|cancel/i.test(`${error.name} ${error.message}`);
      setMsg({ type: "err", text: annule ? t("Ajout annulé.") : `${t("Impossible d'ajouter cet appareil.")} [${error.name || ""} ${error.message || ""}]`.replace(" []", "") });
      return;
    }
    setMsg({ type: "ok", text: t("Appareil ajouté.") });
    charger();
  }

  // ----- App d'authentification
  async function commencerApp() {
    setMsg(null);
    setOccupe(true);
    // Une activation abandonnée plus tôt laisse un facteur non confirmé : on le retire avant d'en créer un nouveau.
    const { data: liste } = await supabase.auth.mfa.listFactors();
    for (const f of (liste?.all || []).filter((x) => x.factor_type === "totp" && x.status !== "verified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Gozly ${Date.now()}` });
    setOccupe(false);
    if (error || !data) {
      setMsg({ type: "err", text: t("Impossible de commencer l'activation.") });
      return;
    }
    setCode("");
    setInscription({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri });
  }

  async function activerAppGozly() {
    setMsg(null);
    setOccupe(true);
    setChoixApp(false);
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess?.session?.user?.id;
    const { data: liste } = await supabase.auth.mfa.listFactors();
    for (const f of (liste?.all || []).filter((x) => x.factor_type === "totp" && x.status !== "verified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `${NOM_FACTEUR_APP_GOZLY} ${Date.now()}` });
    if (error || !data || !userId) {
      setOccupe(false);
      setMsg({ type: "err", text: t("Impossible de commencer l'activation.") });
      return;
    }
    // La clé reste sur cet appareil ; on prouve tout de suite que le code calculé ici est accepté (on réessaie une fois
    // si on tombe pile sur un changement de période de 30 s).
    stockerSecretGozly(userId, { factorId: data.id, secret: data.totp.secret });
    let verif = await supabase.auth.mfa.challengeAndVerify({ factorId: data.id, code: await genererCode(data.totp.secret) });
    if (verif.error) {
      await new Promise((r) => setTimeout(r, 1500));
      verif = await supabase.auth.mfa.challengeAndVerify({ factorId: data.id, code: await genererCode(data.totp.secret) });
    }
    setOccupe(false);
    if (verif.error) {
      effacerSecretGozly(userId);
      await supabase.auth.mfa.unenroll({ factorId: data.id }).catch(() => {});
      setMsg({ type: "err", text: t("Impossible de commencer l'activation.") });
      return;
    }
    setMsg({ type: "ok", text: t("App Gozly activée. Tes codes sont dans Menu > Mes codes.") });
    charger();
  }

  async function confirmerApp(e) {
    e.preventDefault();
    setMsg(null);
    setOccupe(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: inscription.id, code });
    setOccupe(false);
    if (error) {
      setMsg({ type: "err", text: t("Code invalide. Réessaie avec le code actuel de ton app.") });
      setCode("");
      return;
    }
    setInscription(null);
    setCode("");
    setMsg({ type: "ok", text: t("App d'authentification ajoutée.") });
    charger();
  }

  async function copierCle() {
    try {
      await navigator.clipboard.writeText(inscription.secret);
      setCleCopiee(true);
      setTimeout(() => setCleCopiee(false), 2000);
    } catch {}
  }

  async function annulerApp() {
    if (inscription) await supabase.auth.mfa.unenroll({ factorId: inscription.id }).catch(() => {});
    setInscription(null);
    setCode("");
    setMsg(null);
  }

  // ----- Retrait d'une méthode : on prouve d'abord qu'on y a accès (code ou appareil), puis on la retire
  async function retirer(methode, e) {
    e?.preventDefault();
    setMsg(null);
    setOccupe(true);
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess?.session?.user?.id;
    const local = userId ? lireSecretGozly(userId) : null;
    const codeAuto = local && local.factorId === methode.id ? await genererCode(local.secret) : null;
    const verif =
      methode.type === "totp"
        ? await supabase.auth.mfa.challengeAndVerify({ factorId: methode.id, code: codeAuto || code })
        : await supabase.auth.mfa.webauthn.authenticate({ factorId: methode.id });
    if (verif.error) {
      setOccupe(false);
      setCode("");
      const annule = /NotAllowed|abort|cancel/i.test(`${verif.error.name} ${verif.error.message}`);
      setMsg({ type: "err", text: methode.type === "totp" ? t("Code invalide. Réessaie avec le code actuel de ton app.") : annule ? t("Vérification annulée.") : t("La vérification a échoué.") });
      return;
    }
    const { error } = await supabase.auth.mfa.unenroll({ factorId: methode.id });
    if (!error && local && local.factorId === methode.id) effacerSecretGozly(userId);
    setOccupe(false);
    setCode("");
    setRetrait(null);
    if (error) {
      setMsg({ type: "err", text: t("La désactivation a échoué.") });
      return;
    }
    setMsg({ type: "ok", text: t("Méthode retirée.") });
    charger();
  }

  if (!methodes) return <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>;

  const aApp = methodes.some((m) => m.type === "totp");
  const actif = methodes.length > 0;

  return (
    <div className="gestion-section">
      {!sansTitre && (
        <>
          <Link href="/gestion/parametres" className="retour-parametres">
            ‹ {t("Paramètres")}
          </Link>
          <h2 style={{ marginBottom: "4px" }}>{t("Sécurité")}</h2>
          <p className="section-hint">{t("Double authentification")}</p>
        </>
      )}

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {inscription ? (
        <form className="da-carte" onSubmit={confirmerApp}>
          <p>{t("Dans ton app d'authentification (Google Authenticator, Microsoft Authenticator...), choisis « Scanner un code QR », pas l'appareil photo du téléphone.")}</p>
          <img className="da-qr" src={inscription.qr} alt="" />
          <div className="da-actions">
            <a className="admin-icon-btn da-lien" href={inscription.uri}>
              {t("Ouvrir dans mon app d'authentification")}
            </a>
            <button type="button" className="admin-icon-btn" onClick={copierCle}>
              {cleCopiee ? t("Clé copiée") : t("Copier la clé")}
            </button>
          </div>
          <p className="da-secret">
            {t("Sur le même téléphone ? Utilise le bouton ci-dessus ou entre cette clé :")} <code>{inscription.secret}</code>
          </p>
          <label htmlFor="code-da-activation" className="da-etiquette">
            {t("Code à 6 chiffres")}
          </label>
          <CodeDoubleAuth id="code-da-activation" value={code} onChange={setCode} disabled={occupe} autoFocus={false} />
          <div className="da-actions">
            <button type="submit" className="submit-btn" disabled={occupe || code.length !== 6}>
              {t("Activer")}
            </button>
            <button type="button" className="admin-icon-btn" onClick={annulerApp} disabled={occupe}>
              {t("Annuler")}
            </button>
          </div>
        </form>
      ) : (
        <div className="da-carte">
          <p className={`da-etat${actif ? " actif" : ""}`}>
            {actif ? t("Activée : une vérification est demandée à chaque connexion.") : t("Désactivée.")}
          </p>

          {methodes.map((m) => (
            <div key={m.id} className="da-methode">
              <div className="da-methode-ligne">
                <span>{m.type === "totp" ? (m.nom.startsWith(NOM_FACTEUR_APP_GOZLY) ? t("App Gozly (app gestion)") : t("App d'authentification")) : `${t("Appareil")}${m.nom ? " : " + m.nom : ""}`}</span>
                {retrait?.id !== m.id && (
                  <button
                    type="button"
                    className="admin-icon-btn danger"
                    disabled={occupe}
                    onClick={() => {
                      setRetrait(m);
                      setCode("");
                      setMsg(null);
                      if (m.nom.startsWith(NOM_FACTEUR_APP_GOZLY)) retirer(m);
                    }}
                  >
                    {t("Retirer")}
                  </button>
                )}
              </div>
              {retrait?.id === m.id &&
                (m.type === "totp" ? (
                  <form onSubmit={(e) => retirer(m, e)}>
                    <label htmlFor="code-da-retrait" className="da-etiquette">
                      {t("Entre un code pour confirmer")}
                    </label>
                    <CodeDoubleAuth id="code-da-retrait" value={code} onChange={setCode} disabled={occupe} />
                    <div className="da-actions">
                      <button type="submit" className="admin-icon-btn danger" disabled={occupe || code.length !== 6}>
                        {t("Retirer")}
                      </button>
                      <button type="button" className="admin-icon-btn" onClick={() => setRetrait(null)} disabled={occupe}>
                        {t("Annuler")}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="da-actions">
                    <button type="button" className="admin-icon-btn danger" disabled={occupe} onClick={() => retirer(m)}>
                      {t("Confirmer avec l'appareil")}
                    </button>
                    <button type="button" className="admin-icon-btn" onClick={() => setRetrait(null)} disabled={occupe}>
                      {t("Annuler")}
                    </button>
                  </div>
                ))}
            </div>
          ))}

          {choixApp ? (
            <div className="da-choix">
              <p className="da-etiquette">{t("Quelle app veux-tu utiliser ?")}</p>
              <button type="button" className="da-option" onClick={activerAppGozly} disabled={occupe}>
                <strong>{t("App Gozly")}</strong>
                <span>{t("Les codes sont dans cette app (Menu > Mes codes).")}</span>
              </button>
              <button type="button" className="da-option" onClick={commencerApp} disabled={occupe}>
                <strong>{t("Google ou Microsoft Authenticator")}</strong>
                <span>{t("Tu scannes un code QR avec cette app.")}</span>
              </button>
              <button type="button" className="admin-icon-btn" onClick={() => setChoixApp(false)}>
                {t("Annuler")}
              </button>
            </div>
          ) : (
            <div className="da-actions">
              {!aApp && (
                <button type="button" className="submit-btn" onClick={() => (dansApp ? setChoixApp(true) : commencerApp())} disabled={occupe}>
                  {t("Ajouter une app d'authentification")}
                </button>
              )}
              {APPAREIL_DISPONIBLE && (
                <button type="button" className="admin-icon-btn" onClick={ajouterAppareil} disabled={occupe}>
                  {t("Ajouter cet appareil")}
                </button>
              )}
            </div>
          )}
          {!dansApp && !aApp && !choixApp && (
            <p className="section-hint">{t("Pour utiliser l'App Gozly, active la double authentification depuis l'app gestion sur ton téléphone.")}</p>
          )}
          {actif && <p className="section-hint">{t("Plus accès à tes méthodes ? Appelle l'équipe Gozly : elle peut tout désactiver pour toi.")}</p>}
        </div>
      )}
    </div>
  );
}
