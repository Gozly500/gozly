"use client";

// Menu déroulant réutilisable pour choisir l'emplacement actif - plus
// pratique que des onglets dès qu'il y a plus de 2-3 succursales.
export default function EmplacementSelect({ emplacements, value, onChange, includeToutes }) {
  if (emplacements.length <= 1) return null;

  return (
    <select className="admin-select emplacement-select" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      {includeToutes && <option value="">Toutes les succursales</option>}
      {emplacements.map((e) => (
        <option key={e.id} value={e.id}>
          📍 {e.nom}
        </option>
      ))}
    </select>
  );
}
