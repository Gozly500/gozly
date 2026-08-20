"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ContactForm() {
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");

    const form = e.target;
    const nom = form.name.value;
    const courriel = form.email.value;
    const objet = form.subject.value;
    const message = form.message.value;

    const { error } = await supabase.from("messages_contact").insert({
      nom,
      courriel,
      objet,
      message,
    });

    if (error) {
      console.error(error);
      setStatus("error");
      return;
    }

    setStatus("sent");
    form.reset();
  }

  return (
    <div className="contact-card">
      <form onSubmit={handleSubmit}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="name">Nom</label>
            <input type="text" id="name" name="name" placeholder="Entrer votre nom" />
          </div>
          <div className="field">
            <label htmlFor="email">Courriel *</label>
            <input type="email" id="email" name="email" placeholder="Entrer votre adresse..." required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="subject">Objets</label>
          <input type="text" id="subject" name="subject" placeholder="" />
        </div>
        <div className="field">
          <label htmlFor="message">Écrivez nous</label>
          <textarea id="message" name="message" placeholder="Entrer votre texte ici"></textarea>
        </div>
        <div className="submit-wrap">
          <button type="submit" className="submit-btn" disabled={status === "sending"}>
            {status === "sending" ? "Envoi..." : "Envoyer"}
          </button>
        </div>
        {status === "sent" && (
          <p style={{ color: "#7ee787", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>
            Merci! On te répond bientôt.
          </p>
        )}
        {status === "error" && (
          <p style={{ color: "#ff8a8a", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>
            Une erreur est survenue, réessaie dans un instant.
          </p>
        )}
      </form>
    </div>
  );
}
