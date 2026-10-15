"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";

export default function ContactForm() {
  const { t } = useT();
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
            <label htmlFor="name">{t("contact.nom")}</label>
            <input type="text" id="name" name="name" placeholder={t("contact.nomPh")} />
          </div>
          <div className="field">
            <label htmlFor="email">{t("contact.courriel")}</label>
            <input type="email" id="email" name="email" placeholder={t("contact.courrielPh")} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="subject">{t("contact.objet")}</label>
          <input type="text" id="subject" name="subject" placeholder="" />
        </div>
        <div className="field">
          <label htmlFor="message">{t("contact.message")}</label>
          <textarea id="message" name="message" placeholder={t("contact.messagePh")}></textarea>
        </div>
        <div className="submit-wrap">
          <button type="submit" className="submit-btn" disabled={status === "sending"}>
            {status === "sending" ? t("contact.envoi") : t("contact.envoyer")}
          </button>
        </div>
        {status === "sent" && (
          <p style={{ color: "#7ee787", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>
            {t("contact.merci")}
          </p>
        )}
        {status === "error" && (
          <p style={{ color: "#ff8a8a", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>
            {t("contact.erreur")}
          </p>
        )}
      </form>
    </div>
  );
}
