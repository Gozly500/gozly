"use client";

export default function ContactForm() {
  function handleSubmit(e) {
    e.preventDefault();
    // TODO: brancher sur Supabase (table "messages") une fois le projet Supabase créé.
    alert("Merci! On te répond bientôt.");
  }

  return (
    <div className="contact-card">
      <form onSubmit={handleSubmit}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="name">Nom</label>
            <input type="text" id="name" placeholder="Entrer votre nom" />
          </div>
          <div className="field">
            <label htmlFor="email">Courriel *</label>
            <input type="email" id="email" placeholder="Entrer votre adresse..." required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="subject">Objets</label>
          <input type="text" id="subject" placeholder="" />
        </div>
        <div className="field">
          <label htmlFor="message">Écrivez nous</label>
          <textarea id="message" placeholder="Entrer votre texte ici"></textarea>
        </div>
        <div className="submit-wrap">
          <button type="submit" className="submit-btn">
            Envoyer
          </button>
        </div>
      </form>
    </div>
  );
}
