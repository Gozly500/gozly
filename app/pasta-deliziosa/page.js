"use client";

// Page blague, hors du site : aucun lien n'y mène et rien n'est enregistré ni envoyé.
import { useEffect, useState } from "react";

const police = "Arial, sans-serif";
const bouton = {
  fontFamily: police,
  fontSize: 18,
  padding: "12px 34px",
  background: "#fff",
  color: "#000",
  border: "1px solid #000",
  borderRadius: 4,
  cursor: "pointer",
};
const champ = { ...bouton, padding: "11px 14px", cursor: "text", width: "100%", boxSizing: "border-box", colorScheme: "light" };
const etiquette = { display: "flex", flexDirection: "column", gap: 6, textAlign: "left", fontSize: 16 };

export default function PageBlague() {
  const [etape, setEtape] = useState("accueil");
  const [choix, setChoix] = useState("");
  const [date, setDate] = useState("");
  const [nom, setNom] = useState("");
  const complet = date && nom.trim();

  // Après le message, retour au bouton « Réserver ».
  useEffect(() => {
    if (etape !== "fini") return;
    const minuterie = setTimeout(() => setEtape("accueil"), 2500);
    return () => clearTimeout(minuterie);
  }, [etape]);

  function choisir(c) {
    setChoix(c);
    setDate("");
    setNom("");
    setEtape("confirmation");
  }

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        overflow: "auto",
        background: "#fff",
        color: "#000",
        fontFamily: police,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: 20,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontFamily: police, fontSize: 40, fontWeight: 400, margin: 0, color: "#000" }}>Pasta Deliziosa</h1>
      {etape === "accueil" && (
        <button type="button" style={bouton} onClick={() => setEtape("choix")}>
          Réserver
        </button>
      )}
      {etape === "choix" && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
          {["Complète", "Demi", "Quart"].map((c) => (
            <button type="button" key={c} style={bouton} onClick={() => choisir(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      {etape === "confirmation" && (
        <form
          style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 300 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (complet) setEtape("fini");
          }}
        >
          <strong style={{ fontSize: 22 }}>{choix}</strong>
          <label style={etiquette}>
            Date
            <input type="date" style={champ} value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label style={etiquette}>
            Nom
            <input type="text" style={champ} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" required />
          </label>
          <button type="submit" style={{ ...bouton, opacity: complet ? 1 : 0.4 }} disabled={!complet}>
            Confirmer
          </button>
        </form>
      )}
      {etape === "fini" && <p style={{ fontSize: 24, margin: 0 }}>C'est fait, bye !</p>}
    </main>
  );
}
