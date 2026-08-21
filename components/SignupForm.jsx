"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const FORFAITS = [
  { id: "none", label: "Aucun forfait pour l'instant", detail: "Choisis-en un plus tard" },
  { id: "opale", label: "Opale", detail: "3 modules - 25$/mois" },
  { id: "onyx", label: "Onyx", detail: "5 modules - 40$/mois" },
  { id: "crystal", label: "Crystal", detail: "Modules illimités - 50$/mois" },
];

export default function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [entrepriseName, setEntrepriseName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forfait, setForfait] = useState("none");
  const [forfaitOpen, setForfaitOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

    // 3. Sinon, créer sa propre entreprise (on génère son identifiant
    //    nous-mêmes, pour ne pas dépendre d'une relecture immédiate).
    const entrepriseId = crypto.randomUUID();

    const { error: entrepriseError } = await supabase.from("entreprises").insert({
      id: entrepriseId,
      nom: entrepriseName,
      forfait: forfait === "none" ? null : forfait,
    });

    if (entrepriseError) {
      setLoading(false);
      setError("Ton compte est créé, mais l'entreprise n'a pas pu être enregistrée. Contacte-nous.");
      return;
    }

    // 4. Lier le compte à l'entreprise (profil + adhésion propriétaire)
    const { error: profilError } = await supabase.from("profils").insert({
      id: user.id,
      entreprise_id: entrepriseId,
      full_name: fullName,
    });

    if (profilError) {
      setLoading(false);
      setError("Ton compte est créé, mais le lien avec l'entreprise a échoué. Contacte-nous.");
      return;
    }

    const { error: membreError } = await supabase
      .from("membres")
      .insert({ entreprise_id: entrepriseId, user_id: user.id, role: "proprietaire" });

    setLoading(false);

    if (membreError) {
      setError("Ton compte est créé, mais le lien avec l'entreprise a échoué. Contacte-nous.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="contact-card">
      <form onSubmit={handleSubmit}>
        <div className="field-row">
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
            <label htmlFor="entrepriseName">Nom de l'entreprise</label>
            <input
              type="text"
              id="entrepriseName"
              value={entrepriseName}
              onChange={(e) => setEntrepriseName(e.target.value)}
              placeholder="Nom de l'entreprise"
              required
            />
          </div>
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

        <div className="field">
          <label>Forfait</label>
          <div className="forfait-select-wrap">
            <div
              className={`forfait-select-trigger${forfaitOpen ? " open" : ""}`}
              onClick={() => setForfaitOpen((v) => !v)}
            >
              <div>
                <div className="fs-label">{FORFAITS.find((f) => f.id === forfait)?.label}</div>
                <div className="fs-detail">{FORFAITS.find((f) => f.id === forfait)?.detail}</div>
              </div>
              <span className="fs-arrow">▾</span>
            </div>
            {forfaitOpen && (
              <div className="forfait-select-options open">
                {FORFAITS.map((f) => (
                  <div
                    key={f.id}
                    className="forfait-option"
                    onClick={() => {
                      setForfait(f.id);
                      setForfaitOpen(false);
                    }}
                  >
                    <div className="fo-label">{f.label}</div>
                    <div className="fo-detail">{f.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
