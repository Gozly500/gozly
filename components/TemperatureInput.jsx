"use client";

// Champ de température qui marche sur tous les téléphones : certains claviers
// numériques (Samsung, Pixel...) n'ont pas de touche "-", donc un bouton ±
// inverse le signe. Le champ est en texte (pas type="number") pour que le "-"
// tapé au clavier ne soit pas avalé par le navigateur pendant la saisie.
export default function TemperatureInput({ value, onChange, placeholder }) {
  function nettoyer(brut) {
    const sansVirgule = brut.replace(",", ".");
    const negatif = sansVirgule.trim().startsWith("-");
    const corps = sansVirgule.replace(/[^0-9.]/g, "");
    const [entier, ...reste] = corps.split(".");
    const nombre = reste.length > 0 ? `${entier}.${reste.join("")}` : entier;
    return (negatif ? "-" : "") + nombre;
  }

  function inverserSigne() {
    const courant = value ?? "";
    onChange(courant.startsWith("-") ? courant.slice(1) : `-${courant}`);
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", paddingRight: "34px" }}
        value={value ?? ""}
        onChange={(e) => onChange(nettoyer(e.target.value))}
      />
      <button
        type="button"
        onClick={inverserSigne}
        aria-label="+/-"
        style={{
          position: "absolute",
          right: "4px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "28px",
          height: "28px",
          borderRadius: "8px",
          border: "1px solid rgba(var(--w),0.25)",
          background: "rgba(var(--w),0.1)",
          color: "inherit",
          fontSize: "14px",
          fontWeight: 700,
          padding: 0,
          cursor: "pointer",
        }}
      >
        ±
      </button>
    </div>
  );
}
