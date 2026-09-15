// Client pour l'API Nethris ("API - Accès aux données", guide technique
// octobre 2024, fourni par l'utilisateur). Point d'entrée unique
// ExecuteRequest, JSON encodé deux fois (Parameters est une chaîne JSON,
// pas un objet - voir Annexe 1 du guide pour l'exemple de référence).

const BASE_URL = process.env.NETHRIS_BASE_URL || "https://clients.nethris.com/CSPaySuiteServices/wsWebSuiteService.svc";

async function executeRequest(body) {
  const res = await fetch(`${BASE_URL}/V.1.00/ExecuteRequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const codeRetour = Number(data.ReturnCode);

  if (codeRetour !== 0) {
    const regles = Array.isArray(data.BrokenRules) ? data.BrokenRules : data.BrokenRules ? [data.BrokenRules] : [];
    const message = regles.map((r) => r.Text).filter(Boolean).join(" ") || "Erreur inconnue retournée par Nethris.";
    const err = new Error(message);
    err.brokenRules = regles;
    throw err;
  }

  return data;
}

// Authentifie l'utilisateur de services et retourne le sessionId à utiliser
// pour les appels suivants (expire après 30 min d'inactivité - voir guide).
export async function nethrisLogin({ businessCode, userCode, userPassword }) {
  const appId = process.env.NETHRIS_APP_ID;
  if (!appId) throw new Error("NETHRIS_APP_ID n'est pas configuré.");

  const data = await executeRequest({
    SessionId: "",
    Type: "logIn",
    Entity: "",
    Id: "",
    Parameters: JSON.stringify({ AppID: appId, businessCode, userCode, userPassword, language: "fr-CA" }),
  });

  const retour = JSON.parse(data.ReturnData);
  return retour.sessionId;
}

export async function nethrisLogout(sessionId) {
  try {
    await executeRequest({ SessionId: sessionId, Type: "logOut", Entity: "", Id: "", Parameters: "{}" });
  } catch {
    // La déconnexion est une politesse, pas une opération critique - la
    // session expire d'elle-même après 30 min si ça échoue.
  }
}

// Transmet un fichier de transactions de paie. fileContent doit déjà être
// encodé en Base64. FileFormat 0 = colonnes délimitées (.txt/.csv) - voir
// Annexe 2/2.8 du guide pour les autres valeurs possibles.
export async function nethrisPutFilePaie({ sessionId, fileName, fileContent }) {
  await executeRequest({
    SessionId: sessionId,
    Type: "putFile",
    Entity: "PAYFILE",
    Id: "",
    Parameters: JSON.stringify({ FileName: fileName, FileFormat: 0, FileContent: fileContent }),
  });
}
