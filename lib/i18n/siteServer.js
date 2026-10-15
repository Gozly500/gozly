import { cookies, headers } from "next/headers";
import { LANG_COOKIE, createT, isValidLang, langDepuisAcceptLanguage } from "@/lib/i18n/site";

// Langue du visiteur, côté serveur : cookie s'il existe, sinon déduite du navigateur.
export function getLang() {
  const c = cookies().get(LANG_COOKIE)?.value;
  if (isValidLang(c)) return c;
  return langDepuisAcceptLanguage(headers().get("accept-language"));
}

export function getT() {
  const lang = getLang();
  return { lang, t: createT(lang) };
}
