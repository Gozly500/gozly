import { createClient } from "@supabase/supabase-js";
import { getSupabaseForToken } from "@/lib/stripeServer";

// Vérifie que l'appelant est authentifié ET présent dans la table admins.
export async function requireAdmin(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return { errorStatus: 401, errorMessage: "Non authentifié." };

  const supabase = getSupabaseForToken(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return { errorStatus: 401, errorMessage: "Non authentifié." };

  const { data: admin } = await supabase.from("admins").select("id").eq("email", user.email).maybeSingle();
  if (!admin) return { errorStatus: 403, errorMessage: "Accès refusé." };

  return { user };
}

// Client Supabase avec la clé service_role - contourne RLS, réservé aux
// actions admin qui ont besoin de toucher aux comptes d'autres personnes
// (courriel de connexion, mot de passe) via l'API admin de Supabase Auth.
export function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key);
}

export function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}
