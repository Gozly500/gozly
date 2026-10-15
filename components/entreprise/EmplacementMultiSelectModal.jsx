"use client";

import { useState } from "react";
import { useT } from "@/components/LangProvider";

// Popup générique pour choisir une ou plusieurs succursales, avec
// recherche - utilisé par l'éditeur de permissions (Équipe), réutilisable
// ailleurs. "value" est un tableau d'ids, où null représente "toutes les
// succursales" (mutuellement exclusif avec une sélection individuelle).
export default function EmplacementMultiSelectModal({ emplacements, value, onChange, onClose }) {
  const { t } = useT();
  const [recherche, setRecherche] = useState("");

  const toutesSelectionnees = value.includes(null);
  const emplacementsFiltres = emplacements.filter((e) => e.nom.toLowerCase().includes(recherche.toLowerCase()));

  function toggleToutes() {
    onChange(toutesSelectionnees ? [] : [null]);
  }

  function toggleEmplacement(id) {
    // Cocher une succursale précise pendant que "Toutes" est actif bascule
    // directement sur cette seule succursale, plutôt que de forcer à
    // décocher "Toutes" en premier.
    if (toutesSelectionnees) {
      onChange([id]);
      return;
    }
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: "360px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("Succursales")}</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            {t("Fermer")}
          </button>
        </div>

        <label className="switch-row" style={{ marginBottom: "14px", cursor: "pointer" }}>
          <div className="switch-row-text">
            <h4>{t("Toutes les succursales")}</h4>
          </div>
          <input type="checkbox" className="permission-checkbox" checked={toutesSelectionnees} onChange={toggleToutes} />
        </label>

        {emplacements.length > 5 && (
          <input
            type="text"
            placeholder={t("Rechercher une succursale...")}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        )}
        <div className="admin-list" style={{ maxHeight: "260px", overflowY: "auto" }}>
          {emplacementsFiltres.map((e) => (
            <label
              key={e.id}
              className="admin-row"
              style={{ cursor: "pointer", opacity: toutesSelectionnees ? 0.55 : 1 }}
              onClick={(ev) => {
                ev.preventDefault();
                toggleEmplacement(e.id);
              }}
            >
              <div className="admin-row-main">
                <div className="admin-row-title">{e.nom}</div>
              </div>
              <input
                type="checkbox"
                className="permission-checkbox"
                checked={!toutesSelectionnees && value.includes(e.id)}
                readOnly
              />
            </label>
          ))}
          {emplacementsFiltres.length === 0 && <div className="admin-empty">{t("Aucune succursale trouvée.")}</div>}
        </div>

        <div className="admin-edit-actions" style={{ marginTop: "16px" }}>
          <button type="button" className="submit-btn" onClick={onClose}>
            {t("Terminé")}
          </button>
        </div>
      </div>
    </div>
  );
}
