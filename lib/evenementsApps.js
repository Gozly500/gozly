import crypto from "crypto";

// Gozly pousse un événement aux apps de développeurs installées par l'entreprise (au lieu que les apps interrogent Gozly sans arrêt).
// Seules les apps approuvées, non suspendues et qui ont la permission « module:lire » reçoivent l'événement.
// Le corps est signé (HMAC-SHA256 avec la clé de signature de l'app) dans l'en-tête X-Gozly-Signature : « sha256=<hex> ».
// Un envoi qui échoue est simplement ignoré (pas de nouvelle tentative) : l'app peut rattraper avec l'API.

const DELAI_MS = 5000;

export function signerCorps(secret, corps) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(corps).digest("hex");
}

// evenement : ex. "inventaire.modifie". donnees : petit objet (ids, compteurs), jamais de données personnelles.
export async function envoyerEvenement(service, entrepriseId, module, evenement, donnees = {}) {
  const { data: liens } = await service.from("integrations_installees").select("integration_id").eq("entreprise_id", entrepriseId).like("integration_id", "app:%");
  const ids = (liens || []).map((l) => l.integration_id.slice(4));
  if (ids.length === 0) return 0;

  const { data: apps } = await service.from("apps_developpeur").select("id, url_service, secret_page, permissions").in("id", ids).eq("statut", "approuvee").eq("suspendue", false);
  const cibles = (apps || []).filter((a) => a.url_service?.toLowerCase().startsWith("https://") && Array.isArray(a.permissions) && a.permissions.includes(`${module}:lire`));

  const corps = JSON.stringify({ evenement, entreprise_id: entrepriseId, date: new Date().toISOString(), donnees });
  let envoyes = 0;
  await Promise.all(
    cibles.map(async (a) => {
      try {
        const res = await fetch(a.url_service, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Gozly-Evenement": evenement, "X-Gozly-Signature": signerCorps(a.secret_page || "", corps) },
          body: corps,
          signal: AbortSignal.timeout(DELAI_MS),
        });
        if (res.ok) envoyes++;
      } catch {
        // Ignoré : l'app peut rattraper avec l'API.
      }
    })
  );
  return envoyes;
}
