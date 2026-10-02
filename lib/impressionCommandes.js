// Impression des bons de commande sur une imprimante Epson TM-m30III via
// Epson Server Direct Print : l'imprimante interroge Gozly (voir
// app/api/impression/epson/[token]/route.js), on lui répond avec un bon en
// ePOS-Print XML. Ce fichier ne sert que côté serveur.

const LARGEUR = 42; // colonnes sûres sur du papier 80 mm (police A)

// Le XML d'impression reste en ASCII : sans table de caractères configurée,
// les accents s'impriment en caractères bizarres - on les retire plutôt.
function ascii(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[  ]/g, " ")
    .replace(/[^\x20-\x7E]/g, "?");
}

function esc(s) {
  return ascii(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function ligne(texte) {
  return `<text>${esc(texte)}&#10;</text>`;
}

function droite(gauche, droit) {
  const g = ascii(gauche);
  const d = ascii(droit);
  return g.length + d.length >= LARGEUR ? `${g} ${d}` : g + " ".repeat(LARGEUR - g.length - d.length) + d;
}

function argent(n) {
  return `${Number(n || 0).toFixed(2).replace(".", ",")} $`;
}

// Coupe un texte long en lignes de la largeur du ticket.
function enveloppe(texte, indentation = "") {
  const mots = ascii(texte).split(/\s+/).filter(Boolean);
  const lignes = [];
  let courante = "";
  for (const mot of mots) {
    if ((courante + " " + mot).trim().length > LARGEUR - indentation.length) {
      if (courante) lignes.push(indentation + courante);
      courante = mot;
    } else {
      courante = (courante + " " + mot).trim();
    }
  }
  if (courante) lignes.push(indentation + courante);
  return lignes;
}

// Téléphone, adresse de livraison et note du client : lus dans la copie
// complète de la commande Wix quand elle est encore là (voir `brut`).
function detailsClient(commande) {
  const brut = commande.brut || {};
  const contact = brut.recipientInfo?.contactDetails || brut.billingInfo?.contactDetails || {};
  const adresse = brut.shippingInfo?.logistics?.shippingDestination?.address || brut.recipientInfo?.address;
  const rue = adresse
    ? adresse.addressLine ||
      adresse.addressLine1 ||
      (adresse.streetAddress ? `${adresse.streetAddress.number || ""} ${adresse.streetAddress.name || ""}`.trim() : null)
    : null;
  const villeCp = adresse ? [adresse.city, adresse.postalCode].filter(Boolean).join(" ") : null;
  return {
    telephone: contact.phone || null,
    adresse: commande.mode === "livraison" ? [rue, villeCp].filter(Boolean) : [],
    note: brut.buyerNote || null,
  };
}

function formatDateHeure(iso) {
  return new Date(iso).toLocaleString("fr-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "jeu. 2 oct., 10:00 - 11:00" (créneau de ramassage, heure du Québec) ou null.
function libelleCreneau(commande) {
  if (!commande.date_ramassage) return null;
  const debut = new Date(commande.date_ramassage);
  const jour = debut.toLocaleDateString("fr-CA", { timeZone: "America/Toronto", weekday: "short", day: "numeric", month: "short" });
  const heure = (d) => d.toLocaleTimeString("fr-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" });
  const fin = commande.date_ramassage_fin ? ` - ${heure(new Date(commande.date_ramassage_fin))}` : "";
  return `${jour}, ${heure(debut)}${fin}`;
}

function enveloppeEpson(contenu) {
  return (
    `<?xml version="1.0" encoding="utf-8" ?>` +
    `<PrintRequestInfo><ePOSPrint><Parameter><devid>local_printer</devid><timeout>20000</timeout></Parameter>` +
    `<PrintData><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">` +
    `<text lang="en" /><text smooth="true" />` +
    contenu +
    `<feed line="3" /><cut type="feed" />` +
    `</epos-print></PrintData></ePOSPrint></PrintRequestInfo>`
  );
}

const GRAS_ON = `<text em="true" />`;
const GRAS_OFF = `<text em="false" />`;
const GROS = `<text width="2" height="2" />`;
const NORMAL = `<text width="1" height="1" />`;
const CENTRE = `<text align="center" />`;
const GAUCHE = `<text align="left" />`;
const SEPARATEUR = ligne("-".repeat(LARGEUR));

export function construireBonCommande(commande, nomEntreprise) {
  const { telephone, adresse, note } = detailsClient(commande);
  const modeTexte = commande.mode === "livraison" ? "LIVRAISON" : commande.mode === "ramassage" ? "RAMASSAGE" : "";
  const paiement = commande.statut_paiement === "PAID" ? "PAYEE" : commande.statut_paiement === "NOT_PAID" ? "A PAYER" : "";

  let x = "";
  x += CENTRE + GRAS_ON + GROS + ligne(`COMMANDE #${commande.numero || ""}`) + NORMAL + GRAS_OFF;
  x += ligne(nomEntreprise || "");
  x += ligne(formatDateHeure(commande.date_commande));
  if (modeTexte) x += `<feed line="1" />` + GRAS_ON + GROS + ligne(modeTexte) + NORMAL + GRAS_OFF;
  // Précommande : le moment où le client vient chercher sa commande, en gros.
  const creneau = libelleCreneau(commande);
  if (creneau) x += GRAS_ON + GROS + ligne(creneau) + NORMAL + GRAS_OFF;
  if (commande.lieu_nom) x += ligne(commande.lieu_nom);
  x += GAUCHE + SEPARATEUR;

  if (commande.client_nom) x += GRAS_ON + ligne(commande.client_nom) + GRAS_OFF;
  if (telephone) x += ligne(`Tel: ${telephone}`);
  for (const l of adresse) x += ligne(l);
  if (commande.client_nom || telephone || adresse.length) x += SEPARATEUR;

  for (const it of commande.items || []) {
    for (const [i, l] of enveloppe(`${it.quantite} x ${it.nom}`).entries()) {
      x += (i === 0 ? GRAS_ON : GRAS_OFF) + ligne(l);
    }
    x += GRAS_OFF;
    for (const opt of it.options || []) {
      for (const l of enveloppe(opt, "   - ")) x += ligne(l);
    }
  }

  x += SEPARATEUR;
  if (note) {
    x += ligne("NOTE DU CLIENT:");
    for (const l of enveloppe(note)) x += ligne(l);
    x += SEPARATEUR;
  }
  x += GRAS_ON + ligne(droite("TOTAL", argent(commande.total))) + GRAS_OFF;
  if (paiement) x += ligne(paiement);

  return enveloppeEpson(x);
}

export function construireBonTest(nomEntreprise) {
  let x = CENTRE + GRAS_ON + GROS + ligne("TEST D'IMPRESSION") + NORMAL + GRAS_OFF;
  x += ligne(nomEntreprise || "Gozly");
  x += ligne(formatDateHeure(new Date().toISOString()));
  x += `<feed line="1" />` + ligne("Si tu lis ce bon,");
  x += ligne("l'impression fonctionne!");
  return enveloppeEpson(x);
}

// Ajoute un bon de commande dans la file d'impression, sauf s'il y en a déjà
// un en attente pour cette même commande. Retourne true si un bon a été créé.
export async function mettreEnFile(service, entrepriseId, commandeId) {
  const { data: existant } = await service
    .from("bons_impression")
    .select("id")
    .eq("entreprise_id", entrepriseId)
    .eq("commande_id", commandeId)
    .in("statut", ["en_attente", "envoye"])
    .maybeSingle();
  if (existant) return false;

  const { error } = await service
    .from("bons_impression")
    .insert({ entreprise_id: entrepriseId, commande_id: commandeId, type: "commande" });
  if (error) {
    console.error("Erreur mise en file d'impression:", error.message);
    return false;
  }
  return true;
}

// Règles d'impression automatique, appelées à chaque changement d'étape
// vers "Traitée" et à la création d'une commande manuelle :
// - rien si l'impression n'est pas configurée ou si la commande a déjà été imprimée ;
// - commandes Wix : imprimées quand elles deviennent Traitées ;
// - commandes manuelles : seulement si le réglage est "automatique".
export async function imprimerAutomatiquement(service, entrepriseId, commandeId, { aLaCreation = false } = {}) {
  const [{ data: entreprise }, { data: commande }] = await Promise.all([
    service.from("entreprises").select("impression_actif, impression_commandes_manuelles").eq("id", entrepriseId).maybeSingle(),
    service.from("commandes_en_ligne").select("id, source, imprime_le").eq("id", commandeId).eq("entreprise_id", entrepriseId).maybeSingle(),
  ]);

  if (!entreprise?.impression_actif || !commande || commande.imprime_le) return false;

  if (commande.source === "manuel") {
    if (entreprise.impression_commandes_manuelles !== "automatique") return false;
  } else if (aLaCreation) {
    return false; // Une commande Wix ne s'imprime qu'au passage à "Traitée".
  }

  return mettreEnFile(service, entrepriseId, commandeId);
}
