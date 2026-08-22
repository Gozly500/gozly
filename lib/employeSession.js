import crypto from "crypto";
import { getServiceClient } from "@/lib/adminServer";

// Sessions de l'app mobile employé ("Gozly Équipe") - un jeton aléatoire à
// forte entropie, dont seul le hachage est stocké (voir employe_sessions.sql).
// Pas besoin d'un algorithme de mot de passe lent (bcrypt/scrypt) : le jeton
// n'est pas un secret choisi par l'utilisateur, sha256 suffit.

export function getBearerToken(request) {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.replace("Bearer ", "").trim() || null;
}

export function genererToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Vérifie un jeton reçu et retourne l'employé associé (avec son
// entreprise), ou null si le jeton est invalide/révoqué.
export async function verifierSession(token) {
  if (!token) return null;

  const service = getServiceClient();
  if (!service) return null;

  const tokenHash = hashToken(token);

  const { data: session } = await service
    .from("employe_sessions")
    .select("id, employe_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session) return null;

  const { data: employe } = await service.from("employes").select("*").eq("id", session.employe_id).maybeSingle();
  if (!employe) return null;

  service.from("employe_sessions").update({ derniere_utilisation: new Date().toISOString() }).eq("id", session.id).then();

  return employe;
}
