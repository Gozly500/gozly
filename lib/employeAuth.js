// Session client de l'app mobile employé - un jeton opaque gardé dans
// localStorage sur l'appareil de l'employé (voir lib/employeSession.js
// côté serveur et les routes /api/employe-app/*).
const CLE_TOKEN = "gozly_employe_token";

export function getEmployeToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CLE_TOKEN);
}

export function setEmployeToken(token) {
  localStorage.setItem(CLE_TOKEN, token);
}

export function clearEmployeToken() {
  localStorage.removeItem(CLE_TOKEN);
}

export async function employeFetch(path, options = {}) {
  const token = getEmployeToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(path, { ...options, headers });
}
