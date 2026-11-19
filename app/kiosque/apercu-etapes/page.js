"use client";

// APERÇU LOCAL TEMPORAIRE (ne pas pousser) : les étapes du mode Liste selon le type de commande, avec de fausses commandes.
// Utilise les vraies fonctions (lib/statutsWix.js) et les mêmes classes que le kiosque.
import { useState } from "react";
import { etapeSuivanteListe, stadeListe, typeCommande } from "@/lib/statutsWix";
import { etapeCommande } from "@/lib/commandes";

const DEMAIN = new Date(Date.now() + 26 * 3600 * 1000).toISOString();

const DEPART = [
  { id: "r1", numero: "44201", type_wix: "restaurant", mode: "ramassage", client_nom: "Restaurants - ramassage", etape: "en_attente", items: [{ quantite: 2, nom: "Fettuccine Alfredo" }], total: 38.5 },
  { id: "r2", numero: "44202", type_wix: "restaurant", mode: "livraison", client_nom: "Restaurants - livraison", etape: "en_attente", items: [{ quantite: 1, nom: "Pizza Margherita" }], total: 24 },
  { id: "b1", numero: "44203", type_wix: "boutique", mode: "ramassage", client_nom: "Boutique", etape: "en_attente", items: [{ quantite: 3, nom: "Sauce maison 500 ml" }], total: 27 },
  { id: "m1", numero: "M-12", type_wix: null, source: "manuel", mode: "ramassage", client_nom: "Commande manuelle", etape: "en_attente", items: [{ quantite: 1, nom: "Tiramisu" }], total: 9 },
  { id: "r3", numero: "44204", type_wix: "restaurant", mode: "ramassage", client_nom: "Restaurants - pour demain", etape: "en_attente", date_ramassage: DEMAIN, items: [{ quantite: 4, nom: "Lasagne" }], total: 64 },
];

const STADES = { en_attente: "En attente", acceptee: "Acceptée", prete: "Prête", livraison: "En livraison", traitee: "Traitée", terminee: "Terminée" };
const BOUTON = { Pending: "Remettre en attente", Accepted: "Accepter", Ready: "Prête", In_Delivery: "En livraison", Fulfilled: "Terminer" };
const COULEURS = { en_attente: "#ffd479", traitee: "#8ab4ff", terminee: "#7ee2a8" };

export default function ApercuEtapes() {
  const [commandes, setCommandes] = useState(DEPART);
  const [sauter, setSauter] = useState(false);
  const [cible, setCible] = useState("Accepted");
  const [journal, setJournal] = useState([]);

  function passer(c, s) {
    setCommandes((prev) => prev.map((x) => (x.id === c.id ? { ...x, etape: s.etape, statut_wix: s.statut || x.statut_wix } : x)));
    setJournal((j) => [`#${c.numero} -> étape Gozly « ${s.etape} »${s.statut ? `, statut Wix « ${s.statut} »` : " (aucun statut Wix : Boutique / manuelle)"}`, ...j].slice(0, 8));
  }

  return (
    <div className="cmd-kiosk" style={{ padding: "24px" }}>
      <h2>Aperçu : étapes du mode Liste par type de commande</h2>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", margin: "12px 0", flexWrap: "wrap" }}>
        <button className="admin-icon-btn" onClick={() => setSauter((v) => !v)}>
          « Accepter » saute directement : {sauter ? "ACTIVÉ" : "désactivé"}
        </button>
        {sauter && ["Accepted", "Ready", "In_Delivery", "Fulfilled"].map((s) => (
          <button key={s} className="admin-icon-btn" style={cible === s ? { background: "rgba(122,63,224,0.35)" } : undefined} onClick={() => setCible(s)}>{s}</button>
        ))}
        <button className="admin-icon-btn" onClick={() => { setCommandes(DEPART); setJournal([]); }}>Réinitialiser</button>
      </div>
      <div className="cmd-kiosk-liste">
        {commandes.map((c) => {
          const etape = etapeCommande(c);
          const suivant = etapeSuivanteListe(c, etape, { sauter, cible });
          const type = typeCommande(c);
          return (
            <article key={c.id} className={`cmd-kiosk-card${etape === "terminee" ? " cmd-kiosk-card-finie" : ""}${etape === "en_attente" ? " cmd-kiosk-card-attente" : ""}`}>
              <div className="cmd-kiosk-card-top"><strong>#{c.numero}</strong><span>{c.date_ramassage ? "demain" : "aujourd'hui"}</span></div>
              <div className="cmd-kiosk-client">{c.client_nom}</div>
              <div className="cmd-kiosk-tags">
                <span className="cmd-kiosk-tag" style={{ color: COULEURS[etape === "terminee" ? "terminee" : etape === "en_attente" ? "en_attente" : "traitee"], fontWeight: 700 }}>
                  {STADES[stadeListe(c, etape)]}
                </span>
                <span className="cmd-kiosk-tag">{type === "restaurant" ? "Wix Restaurants" : type === "boutique" ? "Wix Boutique" : "Manuelle"}</span>
                <span className="cmd-kiosk-tag">{c.mode}</span>
              </div>
              <div className="cmd-kiosk-items">{c.items.map((it, i) => <div key={i}><strong>{it.quantite} ×</strong> {it.nom}</div>)}</div>
              <div className="cmd-kiosk-total">{c.total.toFixed(2)} $</div>
              <div className="cmd-kiosk-actions">
                {suivant && (
                  <button className="submit-btn" onClick={() => passer(c, suivant)}>
                    {type === "restaurant" ? BOUTON[suivant.statut] : suivant.etape === "terminee" ? "Terminer" : "Traitée"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <h3 style={{ marginTop: "20px" }}>Ce que Gozly enverrait</h3>
      <ul>{journal.length === 0 ? <li>(rien encore)</li> : journal.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}
