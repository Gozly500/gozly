// Session client de l'app mobile employé - un jeton opaque gardé dans
// localStorage sur l'appareil de l'employé (voir lib/employeSession.js
// côté serveur et les routes /api/employe-app/*).
const CLE_TOKEN = "gozly_employe_token";

// Certains navigateurs (navigation privée, "bloquer tous les cookies") font
// planter localStorage : on garde alors le jeton en mémoire (valable tant que
// la page reste ouverte) au lieu de faire tomber toute l'application.
let jetonEnMemoire = null;

export function getEmployeToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CLE_TOKEN) || jetonEnMemoire;
  } catch {
    return jetonEnMemoire;
  }
}

export function setEmployeToken(token) {
  jetonEnMemoire = token;
  try {
    localStorage.setItem(CLE_TOKEN, token);
  } catch {}
}

export function clearEmployeToken() {
  jetonEnMemoire = null;
  try {
    localStorage.removeItem(CLE_TOKEN);
  } catch {}
}

export async function employeFetch(path, options = {}) {
  const token = getEmployeToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(path, { ...options, headers });
}
