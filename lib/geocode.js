// Convertit une adresse texte en coordonnées GPS via Nominatim
// (OpenStreetMap) - gratuit, pas de clé API. Usage faible volume
// uniquement (un appel quand le proprio ajoute/modifie une succursale
// dans Emplacements), respecte largement la politique d'usage de
// Nominatim (max ~1 req/s).
export async function geocoderAdresse(adresse) {
  const q = adresse.trim();
  if (!q) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;

  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = await res.json();
  const premier = data?.[0];
  if (!premier) return null;

  return { latitude: parseFloat(premier.lat), longitude: parseFloat(premier.lon) };
}

// Distance à vol d'oiseau entre deux points GPS, en mètres (formule de
// haversine) - utilisé pour vérifier qu'un employé qui pointe depuis
// l'app mobile est bien à proximité de sa succursale.
export function distanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
