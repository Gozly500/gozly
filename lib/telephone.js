// Numéro de téléphone nord-américain mis en forme pendant la saisie : 514-555-0123 (les chiffres se séparent
// tout seuls par des tirets). Un indicatif « +1 » ou « 1 » devant est retiré ; un numéro international
// (+33...) est laissé tel quel. Sert à la saisie des commandes et à l'import des commandes Wix.
export function formaterTelephone(valeur) {
  const texte = String(valeur ?? "").trim();
  if (texte.startsWith("+") && !texte.startsWith("+1")) return texte.slice(0, 20);
  let chiffres = texte.replace(/\D/g, "");
  if (chiffres.length > 10 && chiffres.startsWith("1")) chiffres = chiffres.slice(1);
  chiffres = chiffres.slice(0, 10);
  if (chiffres.length <= 3) return chiffres;
  if (chiffres.length <= 6) return `${chiffres.slice(0, 3)}-${chiffres.slice(3)}`;
  return `${chiffres.slice(0, 3)}-${chiffres.slice(3, 6)}-${chiffres.slice(6)}`;
}
