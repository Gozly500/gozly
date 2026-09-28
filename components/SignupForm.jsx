"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Forfaits qu'on peut présélectionner via /inscription?forfait=... (depuis la page
// des forfaits). Le forfait n'est JAMAIS activé à l'inscription : il ne l'est
// qu'après paiement Stripe (webhook) - voir /parametres?acheter=...
const FORFAITS_ACHETABLES = {
  opale: "Opale - 3 modules - 25$/mois",
  onyx: "Onyx - 5 modules - 40$/mois",
  crystal: "Crystal - modules illimités - 50$/mois",
};

export default function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forfaitVoulu, setForfaitVoulu] = useState(null);

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("forfait");
    if (f && FORFAITS_ACHETABLES[f]) setForfaitVoulu(f);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // 1. Créer le compte utilisateur (le nom est aussi stocké dans les
    //    métadonnées du compte, pour que le dashboard puisse l'afficher).
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message.includes("already registered")
        ? "Ce courriel est déjà utilisé."
        : "Une erreur est survenue à l'inscription.");
      return;
    }

    const user = signUpData.user;
    if (!user) {
      setLoading(false);
      setError("Vérifie ton courriel pour confirmer ton compte, puis connecte-toi.");
      return;
    }

    // 2. Ce courriel a-t-il été invité à rejoindre une entreprise
    //    existante ? Si oui, on ne crée pas de nouvelle entreprise - la
    //    personne rejoindra celle qui l'a invitée en acceptant.
    const { data: invitationsEnAttente } = await supabase
      .from("invitations")
      .select("id")
      .eq("email", email)
      .eq("statut", "en_attente")
      .limit(1);

    if (invitationsEnAttente && invitationsEnAttente.length > 0) {
      const { error: profilError } = await supabase.from("profils").insert({
        id: user.id,
        full_name: fullName,
      });

      setLoading(false);

      if (profilError) {
        setError("Ton compte est créé, mais une erreur est survenue. Contacte-nous.");
        return;
      }

      router.push("/invitations");
      return;
    }

    // 3. Sinon, juste le profil - la création de sa première entreprise se
    //    fait juste après, dans le parcours de bienvenue (logo, secteur
    //    d'activité, adresse, etc. - un formulaire plus complet qu'ici).
    const { error: profilError } = await supabase.from("profils").insert({
      id: user.id,
      full_name: fullName,
    });

    setLoading(false);

    if (profilError) {
      setError("Ton compte est créé, mais une erreur est survenue. Contacte-nous.");
      return;
    }

    router.push(forfaitVoulu ? `/bienvenue?forfait=${forfaitVoulu}` : "/bienvenue");
  }

  return (
    <div className="contact-card">
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="fullName">Ton nom</label>
          <input
            type="text"
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ton nom"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="email">Courriel</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@courriel.com"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 caractères"
            minLength={6}
            required
          />
        </div>

        {forfaitVoulu && (
          <p className="section-hint" style={{ textAlign: "center", margin: "0 0 10px" }}>
            Forfait choisi : <strong>{FORFAITS_ACHETABLES[forfaitVoulu]}</strong>. Tu paieras à l'étape suivante.
          </p>
        )}

        <p className="legal-notice">
          En créant un compte, tu acceptes nos <Link href="/conditions">Conditions d'utilisation</Link> et notre{" "}
          <Link href="/confidentialite">Politique de confidentialité</Link>.
        </p>

        <div className="submit-wrap">
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Création..." : "Créer mon compte"}
          </button>
        </div>

        {error && (
          <p style={{ color: "#ff8a8a", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
