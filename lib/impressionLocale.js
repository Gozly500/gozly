// Impression par la tablette : l'app Android du kiosque expose un « pont » (window.GozlyImprimante) qui envoie
// des octets à l'imprimante Epson jumelée en Bluetooth. Ici, côté page : on va chercher les bons en attente
// (/api/commandes/bons-locaux), on les convertit en ESC/POS, on les envoie au pont, puis on confirme le résultat.
// Hors de l'app (navigateur ordinaire), le pont n'existe pas et rien de tout ça ne se passe.

import { supabase } from "@/lib/supabaseClient";
import { xmlVersEscPos, octetsVersBase64 } from "@/lib/escpos";

export function pontImprimante() {
  return typeof window !== "undefined" && window.GozlyImprimante ? window.GozlyImprimante : null;
}

// { permission, choisi: { nom, adresse } | null } ou null s'il n'y a pas de pont.
export function etatPont() {
  const pont = pontImprimante();
  if (!pont) return null;
  try {
    return JSON.parse(pont.etat());
  } catch {
    return null;
  }
}

// Appareils Bluetooth déjà jumelés avec la tablette : [{ nom, adresse }].
export function appareilsJumeles() {
  const pont = pontImprimante();
  if (!pont) return [];
  try {
    return JSON.parse(pont.appareils());
  } catch {
    return [];
  }
}

export function choisirImprimante(adresse) {
  pontImprimante()?.choisir(adresse);
}

export function demanderPermissionBluetooth() {
  pontImprimante()?.demanderPermission();
}

// Envoie des octets ESC/POS à l'imprimante choisie. Résout "ok" ou un message d'erreur (jamais de rejet).
export function envoyerOctets(octets) {
  const pont = pontImprimante();
  if (!pont) return Promise.resolve("Pas d'imprimante Bluetooth sur cet appareil.");
  return new Promise((resolve) => {
    window.__retoursImpression = window.__retoursImpression || {};
    const id = `i${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const delai = setTimeout(() => {
      delete window.__retoursImpression[id];
      resolve("L'imprimante ne répond pas.");
    }, 30000);
    window.__retoursImpression[id] = (message) => {
      clearTimeout(delai);
      delete window.__retoursImpression[id];
      resolve(message);
    };
    try {
      pont.imprimer(octetsVersBase64(octets), id);
    } catch (err) {
      clearTimeout(delai);
      delete window.__retoursImpression[id];
      resolve(String(err?.message || "Impression impossible."));
    }
  });
}

export function imprimerXml(xml) {
  return envoyerOctets(xmlVersEscPos(xml));
}

async function appeler(entrepriseId, corps) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/commandes/bons-locaux", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token}` },
    body: JSON.stringify({ entrepriseId, ...corps }),
  });
  return res.ok ? res.json().catch(() => ({})) : {};
}

let enCours = false;

// Va chercher les bons en attente et les imprime un à un. Retourne { imprimes, erreur } ; sans pont ou sans
// imprimante choisie, ne fait rien (les bons restent en file pour l'imprimante par Internet, s'il y en a une).
export async function imprimerBonsLocaux(entrepriseId) {
  const etat = etatPont();
  if (!etat?.permission || !etat.choisi || enCours) return { imprimes: 0, erreur: null };
  enCours = true;
  let imprimes = 0;
  let erreur = null;
  try {
    const { bons } = await appeler(entrepriseId, { action: "prendre" });
    for (const bon of bons || []) {
      const resultat = await imprimerXml(bon.xml);
      const succes = resultat === "ok";
      await appeler(entrepriseId, { action: "termine", bonId: bon.id, succes, erreur: succes ? null : resultat });
      if (succes) imprimes += 1;
      else {
        erreur = resultat;
        break; // les bons suivants restent réservés quelques secondes puis reviennent en file
      }
    }
  } catch {
    erreur = "L'impression a échoué.";
  } finally {
    enCours = false;
  }
  return { imprimes, erreur };
}
