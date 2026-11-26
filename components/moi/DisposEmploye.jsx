"use client";

import { useState } from "react";
import { IconCorbeille, IconFlecheDroite, IconFlecheGauche } from "@/components/icons/Pictogrammes";
import { useLangue } from "@/components/moi/LangueContext";
import { localeDate } from "@/lib/i18n/moi";
import { dateDe, isoDe, heuresDispo, genreDispo } from "@/lib/disponibilites";

// Côté employé : toucher le premier jour puis le dernier, choisir toute la journée ou certaines heures, envoyer.
export default function DisposEmploye({ periodes, onAjouter, onRetirer, nonActif = false }) {
  const { t, langue } = useLangue();
  const locale = localeDate(langue);
  const court = (iso) => dateDe(iso).toLocaleDateString(locale, { day: "numeric", month: "long" });
  const periodeTexte = (debut, fin) => (debut === fin ? court(debut) : t("demandes.duAu", { debut: court(debut), fin: court(fin) }));
  // Initiales des jours, du lundi (5 janvier 2026) au dimanche.
  const initiales = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i, 12).toLocaleDateString(locale, { weekday: "narrow" }));
  const [occupe, setOccupe] = useState(false);
  const [choixNon, setChoixNon] = useState(false);
  const non = nonActif && choixNon;
  const aujourdhui = isoDe(new Date());
  const [mois, setMois] = useState(() => `${aujourdhui.slice(0, 7)}-01`);
  const [debut, setDebut] = useState(null);
  const [fin, setFin] = useState(null);
  const [partiel, setPartiel] = useState(false);
  const [de, setDe] = useState("17:00");
  const [a, setA] = useState("22:00");
  const [note, setNote] = useState("");

  const premier = dateDe(mois);
  const vides = (premier.getDay() + 6) % 7;
  const nbJours = new Date(premier.getFullYear(), premier.getMonth() + 1, 0).getDate();
  const jours = Array.from({ length: nbJours }, (_, i) => `${mois.slice(0, 8)}${String(i + 1).padStart(2, "0")}`);
  const changerMois = (pas) => setMois(isoDe(new Date(premier.getFullYear(), premier.getMonth() + pas, 1, 12)));

  function toucher(iso) {
    if (!debut || fin || iso < debut) {
      setDebut(iso);
      setFin(null);
    } else setFin(iso);
  }

  async function envoyer(e) {
    e.preventDefault();
    if (!debut || occupe) return;
    setOccupe(true);
    const ok = await onAjouter({ debut, fin: fin || debut, de: partiel ? de : null, a: partiel ? a : null, note: note.trim(), non });
    setOccupe(false);
    if (ok === false) return; // la sélection reste pour réessayer
    setDebut(null);
    setFin(null);
    setNote("");
  }

  return (
    <div className="dispo-moi">
      <div className="dispo-cal">
        <div className="dispo-cal-tete">
          <button type="button" className="admin-icon-btn" onClick={() => changerMois(-1)} aria-label={t("dispo.moisPrecedent")}>
            <IconFlecheGauche className="gozly-icon" />
          </button>
          <strong>{premier.toLocaleDateString(locale, { month: "long", year: "numeric" })}</strong>
          <button type="button" className="admin-icon-btn" onClick={() => changerMois(1)} aria-label={t("dispo.moisSuivant")}>
            <IconFlecheDroite className="gozly-icon" />
          </button>
        </div>
        <div className="dispo-cal-grille">
          {initiales.map((j, i) => (
            <span key={i} className="dispo-cal-nom">{j}</span>
          ))}
          {Array.from({ length: vides }, (_, i) => (
            <span key={`v${i}`} />
          ))}
          {jours.map((iso) => {
            const choisi = debut && iso >= debut && iso <= (fin || debut);
            const siennes = periodes.filter((p) => p.debut <= iso && p.fin >= iso);
            // « Pas disponible » l'emporte, puis toute la journée, puis certaines heures.
            const genre = siennes.some((p) => p.non) ? "non" : siennes.length > 0 && siennes.every((p) => p.de) ? "partiel" : "";
            const classes = ["dispo-cal-jour", siennes.length > 0 && "deja", genre, choisi && "choisi", iso === debut && "bout-debut", choisi && iso === (fin || debut) && "bout-fin"];
            return (
              <button type="button" key={iso} className={classes.filter(Boolean).join(" ")} disabled={iso < aujourdhui} onClick={() => toucher(iso)}>
                {Number(iso.slice(8))}
              </button>
            );
          })}
        </div>
        <div className="hdispo-legende">
          <span><i className="hdispo-barre" /> {t("dispo.journee")}</span>
          <span><i className="hdispo-barre partiel" /> {t("dispo.heures")}</span>
          {nonActif && <span><i className="hdispo-barre non" /> {t("dispo.pasDispo")}</span>}
        </div>
      </div>

      {debut && (
        <form className="dispo-form moi-form-entree" onSubmit={envoyer}>
          <strong className="dispo-form-titre">{periodeTexte(debut, fin || debut)}</strong>
          {nonActif && (
            <div className="dispo-choix">
              <button type="button" className={non ? "" : "actif"} onClick={() => setChoixNon(false)}>{t("dispo.dispo")}</button>
              <button type="button" className={non ? "actif non" : ""} onClick={() => setChoixNon(true)}>{t("dispo.pasDispo")}</button>
            </div>
          )}
          <div className="dispo-choix">
            <button type="button" className={partiel ? "" : "actif"} onClick={() => setPartiel(false)}>{t("dispo.journee")}</button>
            <button type="button" className={partiel ? "actif" : ""} onClick={() => setPartiel(true)}>{t("dispo.heures")}</button>
          </div>
          {partiel && (
            <div className="field-row">
              <div className="field">
                <label>{t("dispo.de")}</label>
                <input type="time" value={de} onChange={(e) => setDe(e.target.value)} required />
              </div>
              <div className="field">
                <label>{t("dispo.a")}</label>
                <input type="time" value={a} onChange={(e) => setA(e.target.value)} required />
              </div>
            </div>
          )}
          <div className="field">
            <label>{t("dispo.note")}</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("dispo.notePlaceholder")} maxLength={200} />
          </div>
          <button type="submit" className="submit-btn" disabled={occupe || (partiel && de >= a)}>{t(non ? "dispo.envoyerNon" : "dispo.envoyer")}</button>
        </form>
      )}

      {periodes.length > 0 && (
        <div className="admin-list">
          {[...periodes].sort((x, y) => x.debut.localeCompare(y.debut)).map((p) => (
            <div className={`admin-row dispo-ligne${genreDispo(p)}`} key={p.id}>
              <div className="admin-row-main">
                <div className="admin-row-title">{periodeTexte(p.debut, p.fin)}</div>
                <div className="admin-row-sub">
                  {p.non && `${t("dispo.pasDispo")} · `}
                  {heuresDispo(p) || t("dispo.journee")}
                  {p.note && ` · ${p.note}`}
                </div>
              </div>
              <button type="button" className="admin-icon-btn danger" onClick={() => onRetirer(p.id)} aria-label={t("dispo.retirer")}>
                <IconCorbeille className="gozly-icon" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
