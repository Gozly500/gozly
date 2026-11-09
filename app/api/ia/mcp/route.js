import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { authentifierCle, appelerOutil, outilsPour } from "@/lib/iaServer";
import { CORS, origineDe } from "@/lib/iaOAuth";

export const dynamic = "force-dynamic";

// Serveur MCP (Model Context Protocol) de Gozly, en HTTP sans état : un assistant IA (ChatGPT, Claude...) s'y connecte avec
// la clé générée dans Paramètres > Intégrations > Intelligence artificielle (ou OAuth). Ce qu'il peut faire dépend des permissions
// de l'entreprise (ia_reglages) : voir lib/iaServer.js. La publication de l'horaire est désactivée par défaut.

const VERSION_PROTOCOLE = "2025-03-26";

const INSTRUCTIONS =
  "Tu es branché sur une entreprise Gozly. Les outils offerts dépendent des permissions que le propriétaire a réglées dans Gozly (modules ouverts et actions permises). Si un outil manque ou est refusé, dis-le à la personne : elle peut l'activer dans Gozly (Paramètres > Intégrations > Intelligence artificielle > Permissions de l'IA). " +
  "Agis seulement sur demande de la personne qui te parle, jamais de ton propre chef. Les quarts d'horaire que tu crées sont des BROUILLONS, invisibles des employés. Ne publie l'horaire (publier_horaire, qui notifie les employés) que si la personne te l'a clairement demandé, après lui avoir montré ce qui sera publié. " +
  "Les tâches de Planning n'ont pas de brouillon : elles sont visibles des employés tout de suite, alors confirme avec la personne avant d'en ajouter. " +
  "Lis l'existant avant d'écrire pour éviter les doublons, et dis clairement ce qui a été fait.";

function reponse(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function erreurRpc(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function traiter(service, cle, msg) {
  const { id, method, params } = msg || {};
  // Notification (pas d'id) : rien à répondre.
  if (id === undefined || id === null) return null;

  switch (method) {
    case "initialize":
      return reponse(id, {
        protocolVersion: VERSION_PROTOCOLE,
        capabilities: { tools: {} },
        serverInfo: { name: "gozly", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    case "ping":
      return reponse(id, {});
    case "tools/list":
      return reponse(id, { tools: outilsPour(cle) });
    case "tools/call": {
      const { contenu, erreur } = await appelerOutil(service, cle, params?.name, params?.arguments);
      if (erreur) return reponse(id, { content: [{ type: "text", text: erreur }], isError: true });
      return reponse(id, { content: [{ type: "text", text: JSON.stringify(contenu) }] });
    }
    default:
      return erreurRpc(id, -32601, "Méthode inconnue.");
  }
}

export async function POST(request) {
  const service = getServiceClient();
  if (!service) return NextResponse.json(erreurRpc(null, -32000, "Service indisponible."), { status: 503 });

  // La clé vient de l'en-tête Authorization (à préférer). Certains assistants ne savent pas envoyer d'en-tête :
  // on accepte alors ?cle=... dans l'adresse (moins sûr : une adresse peut se retrouver dans des journaux).
  const entete = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const jeton = entete || new URL(request.url).searchParams.get("cle") || "";

  const { cle, erreur } = await authentifierCle(service, jeton);
  if (erreur) {
    // 401 + WWW-Authenticate : c'est ce qui indique à l'assistant (ChatGPT, Claude...) où se connecter avec OAuth.
    const entetes = { ...CORS };
    if (erreur.status === 401) entetes["WWW-Authenticate"] = `Bearer resource_metadata="${origineDe(request)}/.well-known/oauth-protected-resource"`;
    return NextResponse.json(erreurRpc(null, -32001, erreur.message), { status: erreur.status, headers: entetes });
  }

  const corps = await request.json().catch(() => null);
  if (!corps) return NextResponse.json(erreurRpc(null, -32700, "JSON invalide."), { status: 400 });

  if (Array.isArray(corps)) {
    const reponses = (await Promise.all(corps.map((m) => traiter(service, cle, m)))).filter(Boolean);
    return reponses.length ? NextResponse.json(reponses) : new NextResponse(null, { status: 202 });
  }

  const rep = await traiter(service, cle, corps);
  return rep ? NextResponse.json(rep) : new NextResponse(null, { status: 202 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Pas de flux serveur -> client : GET n'est pas supporté (les clients MCP le comprennent via le 405).
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
