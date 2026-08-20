"use client";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-CA", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default function ActiviteSection({ user }) {
  const rows = [
    { label: "Dernière connexion", value: formatDate(user?.last_sign_in_at) },
    { label: "Compte créé le", value: formatDate(user?.created_at) },
    { label: "Courriel confirmé le", value: formatDate(user?.email_confirmed_at) },
    { label: "Dernière mise à jour du profil", value: formatDate(user?.updated_at) },
  ];

  return (
    <div>
      <h2>Activité du compte</h2>
      <p className="panel-hint">Un aperçu de l'activité récente de ton compte.</p>

      <div className="settings-card">
        <div className="activity-list">
          {rows.map((row) => (
            <div className="activity-row" key={row.label}>
              <span className="activity-row-label">{row.label}</span>
              <span className="activity-row-value">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="section-hint" style={{ marginTop: "18px" }}>
        L'historique détaillé des connexions (appareil, localisation) n'est pas encore disponible.
      </p>
    </div>
  );
}
