"use client";

// Écran affiché quand une page plante côté navigateur : au lieu du message
// anglais générique, un texte clair + le détail technique pour le support.
export default function ErreurPage({ error, reset }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center" }}>
      <div style={{ maxWidth: "420px" }}>
        <h2 style={{ marginBottom: "10px" }}>Oups, quelque chose a planté</h2>
        <p style={{ color: "var(--text-dim)", marginBottom: "18px" }}>
          Réessaie. Si ça continue, envoie-nous une capture d'écran de ce message.
        </p>
        <button type="button" className="btn-small" onClick={() => reset()} style={{ marginRight: "8px" }}>
          Réessayer
        </button>
        <button type="button" className="btn-small" onClick={() => (window.location.href = "/")}>
          Accueil
        </button>
        <p style={{ marginTop: "22px", fontSize: "11.5px", color: "var(--text-dim)", wordBreak: "break-word" }}>
          {String(error?.message || error || "").slice(0, 300)}
          {error?.digest ? ` (${error.digest})` : ""}
        </p>
      </div>
    </div>
  );
}
