"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import Gozyx from "@/components/Gozyx";

const TXT = {
  fr: {
    chargement: "Chargement...",
    connexion: "Connecte-toi à ton compte Gozly pour continuer.",
    seConnecter: "Se connecter",
    invalide: "Ce lien est invalide ou a expiré. Retourne sur Discord et clique à nouveau sur « Lier mon compte Gozly ».",
    confirmer: (nom, courriel) => `Lier le Discord « ${nom || "ton compte"} » au compte Gozly ${courriel} ?`,
    bouton: "Confirmer",
    enCours: "En cours...",
    ok: "C'est fait! Ton compte est lié.",
    okRole: "Le rôle « Compte lié » t'a été donné sur Discord. Tu peux retourner sur le serveur.",
    sansRole: "Ton compte est lié, mais je n'ai pas pu te donner le rôle (le bot n'a pas trouvé le rôle « Compte lié » ou toi sur le serveur). Écris-nous si ça persiste.",
    lie: "Ton compte Gozly est lié à Discord.",
    delier: "Délier mon compte",
    delie: "Ton compte a été délié et le rôle retiré.",
    aucun: "Pour lier ton compte, va dans le salon « sidentifier » du Discord de Gozly et clique sur « Lier mon compte Gozly ».",
    erreur: "Quelque chose n'a pas fonctionné",
    note: "On ne garde que ton identifiant Discord. Tu peux délier ton compte à tout moment.",
  },
  en: {
    chargement: "Loading...",
    connexion: "Log in to your Gozly account to continue.",
    seConnecter: "Log in",
    invalide: "This link is invalid or has expired. Go back to Discord and click \"Link my Gozly account\" again.",
    confirmer: (nom, courriel) => `Link the Discord account "${nom || "yours"}" to the Gozly account ${courriel}?`,
    bouton: "Confirm",
    enCours: "Working...",
    ok: "Done! Your account is linked.",
    okRole: "The \"Linked account\" role was given to you on Discord. You can go back to the server.",
    sansRole: "Your account is linked, but I couldn't give you the role (the bot didn't find the \"Compte lié\" role, or you on the server). Write to us if it persists.",
    lie: "Your Gozly account is linked to Discord.",
    delier: "Unlink my account",
    delie: "Your account was unlinked and the role removed.",
    aucun: "To link your account, go to the \"sidentifier\" channel in the Gozly Discord and click \"Link my Gozly account\".",
    erreur: "Something didn't work",
    note: "We only keep your Discord ID. You can unlink your account at any time.",
  },
};

export default function DiscordLierContent() {
  const { lang } = useT();
  const T = TXT[lang] || TXT.fr;
  const tokenRef = useRef(null);
  const [etape, setEtape] = useState("chargement"); // chargement | connexion | invalide | confirmer | lie | aucun | fini | delie
  const [jeton, setJeton] = useState("");
  const [nom, setNom] = useState("");
  const [courriel, setCourriel] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState("");
  const [roleOk, setRoleOk] = useState(true);

  const session = useCallback(async () => {
    const s = await Promise.race([
      supabase.auth.getSession().then(({ data: { session } }) => session),
      new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    if (s?.access_token) tokenRef.current = s.access_token;
    return s;
  }, []);

  useEffect(() => {
    (async () => {
      const t = new URLSearchParams(window.location.search).get("t") || "";
      setJeton(t);
      const s = await session();
      if (!s) {
        if (t) return setEtape("connexion");
        return setEtape("aucun");
      }
      setCourriel(s.user?.email || "");
      const etat = await fetch("/api/discord/lier", { headers: { Authorization: `Bearer ${s.access_token}` }, cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({}));
      if (t) {
        const v = await fetch(`/api/discord/lier?t=${encodeURIComponent(t)}`, { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({}));
        if (!v.valide) return setEtape("invalide");
        setNom(v.nom || "");
        return setEtape("confirmer");
      }
      setEtape(etat.lie ? "lie" : "aucun");
    })();
  }, [session]);

  async function envoyer(corps) {
    setOccupe(true);
    setMessage("");
    try {
      const s = await session();
      const token = s?.access_token || tokenRef.current;
      const res = await fetch("/api/discord/lier", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corps),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      return json;
    } catch (e) {
      setMessage(`${T.erreur} : ${e.message}`);
      return null;
    } finally {
      setOccupe(false);
    }
  }

  async function confirmer() {
    const r = await envoyer({ t: jeton });
    if (!r) return;
    setRoleOk(r.role === "ok");
    setEtape("fini");
  }

  async function delier() {
    const r = await envoyer({ action: "delier" });
    if (r) setEtape("delie");
  }

  const loginHref = `/login?retour=${encodeURIComponent(`/discord/lier${jeton ? `?t=${jeton}` : ""}`)}`;

  return (
    <div className="aide-wrap" style={{ maxWidth: "560px" }}>
      <div className="aide-carte" style={{ textAlign: "center" }}>
        {etape === "chargement" && <p>{T.chargement}</p>}

        {etape === "connexion" && (
          <>
            <p style={{ marginBottom: "18px" }}>{T.connexion}</p>
            <Link href={loginHref} className="submit-btn" style={{ display: "inline-block", textDecoration: "none" }}>
              {T.seConnecter}
            </Link>
          </>
        )}

        {etape === "invalide" && (
          <>
            <Gozyx humeur="probleme" taille={96} />
            <p style={{ marginTop: "14px" }}>{T.invalide}</p>
          </>
        )}

        {etape === "confirmer" && (
          <>
            <p style={{ marginBottom: "18px", color: "var(--fg)" }}>{T.confirmer(nom, courriel)}</p>
            <button type="button" className="submit-btn" onClick={confirmer} disabled={occupe}>
              {occupe ? T.enCours : T.bouton}
            </button>
            <p style={{ marginTop: "16px", fontSize: "13px" }}>{T.note}</p>
          </>
        )}

        {etape === "fini" && (
          <>
            <Gozyx humeur="content" taille={110} />
            <strong style={{ color: "var(--fg)", display: "block", marginTop: "14px" }}>{T.ok}</strong>
            <p style={{ marginTop: "10px" }}>{roleOk ? T.okRole : T.sansRole}</p>
          </>
        )}

        {etape === "lie" && (
          <>
            <p style={{ marginBottom: "18px", color: "var(--fg)" }}>{T.lie}</p>
            <button type="button" className="submit-btn" onClick={delier} disabled={occupe}>
              {occupe ? T.enCours : T.delier}
            </button>
          </>
        )}

        {etape === "delie" && <p style={{ color: "var(--fg)" }}>{T.delie}</p>}
        {etape === "aucun" && <p>{T.aucun}</p>}
        {message && <p style={{ marginTop: "14px", color: "#ff6b72" }}>{message}</p>}
      </div>
    </div>
  );
}
