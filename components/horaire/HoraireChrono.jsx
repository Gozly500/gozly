"use client";

import { useRef, useState } from "react";
import { IconCorbeille, IconPlus } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";
import { bloc, heureTexte } from "@/lib/horaireJour";

const PAS = 30; // les blocs se calent aux 30 minutes
const JOUR = 1440;
const HEURES = Array.from({ length: 24 }, (_, i) => i);
const caler = (m) => Math.round(m / PAS) * PAS;
const borne = (v, min, max) => Math.max(min, Math.min(max, v));

// Modèle « Chronologie » (style jeu de gestion) : les jours à gauche, les 24 heures en haut, une rangée par employé.
// Glisser sur une rangée vide peint un quart ; glisser un bloc le déplace (aussi vers une autre personne) ; glisser ses bords
// change le début ou la fin ; un clic l'ouvre.
export default function HoraireChrono({ jours, employes, quarts, recherche, onRecherche, onAjouter, onModifier, onHeures, onSupprimer, onCopierJour, onViderJour }) {
  const { t } = useT();
  const [choisi, setChoisi] = useState(null);
  const [sourceCopie, setSourceCopie] = useState(null); // jour à copier : le prochain jour touché le reçoit
  const [geste, setGeste] = useState(null); // glissement en cours (aperçu avant d'enregistrer)
  const gesteRef = useRef(null);

  const aujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
  const jour = jours.find((j) => j.iso === choisi) || jours.find((j) => j.iso === aujourdhui) || jours[0];
  const duJour = quarts.filter((q) => q.date === jour.iso);

  const duree = (minutes) => `${(minutes / 60).toLocaleString(loc(), { maximumFractionDigits: 2 })} h`;
  const pourcent = (m) => `${(m / JOUR) * 100}%`;

  // ---------- Gestes (souris, stylet ou doigt) ----------
  function commencer(e, g) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const piste = e.currentTarget.closest(".hchr-piste");
    const boite = piste.getBoundingClientRect();
    const minute = ((e.clientX - boite.left) / boite.width) * JOUR;
    const hautTable = piste.closest(".hchr-table").getBoundingClientRect().top;
    gesteRef.current = { ...g, boite, hautTable, bas: boite.bottom - hautTable, departX: e.clientX, departY: e.clientY, minute0: minute, bouge: false };
    piste.setPointerCapture(e.pointerId); // la rangée reste en place même si le bloc change de rangée
    setGeste(gesteRef.current);
  }

  function bouger(e) {
    const g = gesteRef.current;
    if (!g) return;
    if (!g.bouge && Math.abs(e.clientX - g.departX) < 5 && Math.abs(e.clientY - g.departY) < 5) return;
    const minute = ((e.clientX - g.boite.left) / g.boite.width) * JOUR;
    const suivant = { ...g, bouge: true };
    if (g.type === "peindre") {
      const a = borne(Math.floor(g.minute0 / PAS) * PAS, 0, JOUR - PAS);
      const b = borne(caler(minute), 0, JOUR);
      suivant.de = Math.min(a, b);
      suivant.a = Math.max(b, b < a ? a + PAS : a + PAS);
    } else {
      const delta = caler(minute - g.minute0);
      if (g.type === "deplacer") {
        suivant.de = borne(g.de0 + delta, 0, g.a0 > JOUR ? JOUR - PAS : JOUR - (g.a0 - g.de0));
        suivant.a = suivant.de + (g.a0 - g.de0);
        // Rangée sous le pointeur : le quart peut changer de personne.
        const rangee = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains("hchr-piste"));
        if (rangee) {
          suivant.employeId = rangee.dataset.employe;
          suivant.bas = rangee.getBoundingClientRect().bottom - g.hautTable;
        }
      } else if (g.type === "debut") {
        suivant.de = borne(g.de0 + delta, 0, Math.min(g.a0, JOUR) - PAS);
      } else {
        suivant.a = borne(g.a0 + delta, g.de0 + PAS, JOUR);
      }
    }
    gesteRef.current = suivant;
    setGeste(suivant);
  }

  function finir() {
    const g = gesteRef.current;
    if (!g) return;
    gesteRef.current = null;
    setGeste(null);
    if (g.type === "peindre") {
      if (g.bouge) onAjouter(g.employeId, jour.iso, heureTexte(g.de), heureTexte(g.a), true);
      else {
        const depart = borne(Math.floor(g.minute0 / 60) * 60, 0, 23 * 60);
        onAjouter(g.employeId, jour.iso, heureTexte(depart), heureTexte(depart + 4 * 60), false);
      }
      return;
    }
    if (!g.bouge) {
      onModifier(g.quart);
      return;
    }
    const employe = employes.find((x) => String(x.id) === String(g.employeId));
    onHeures(g.quart, { heure_debut: heureTexte(g.de), heure_fin: heureTexte(g.a), employe_id: employe ? employe.id : g.quart.employe_id });
  }

  const annuler = () => {
    gesteRef.current = null;
    setGeste(null);
  };

  // Repères pendant un glissement : une ligne monte de la rangée jusqu'aux heures, avec l'heure exacte.
  const reperes = !geste?.bouge ? [] : geste.type === "debut" ? [geste.de] : geste.type === "fin" ? [geste.a] : [geste.de, geste.a];

  function choisirJour(iso) {
    if (sourceCopie && sourceCopie !== iso) onCopierJour(sourceCopie, iso);
    setSourceCopie(null);
    setChoisi(iso);
  }

  return (
    <div className="hchr">
      <div className="hchr-jours">
        {jours.map((j) => {
          const actif = j.iso === jour.iso;
          const nb = new Set(quarts.filter((q) => q.date === j.iso).map((q) => q.employe_id)).size;
          return (
            <div key={j.iso} className={`hchr-jour${actif ? " actif" : ""}${sourceCopie && sourceCopie !== j.iso ? " cible" : ""}`}>
              <button type="button" className="hchr-jour-nom" onClick={() => choisirJour(j.iso)}>
                <strong>{j.nom}</strong>
                <span>{j.date} · {nb}</span>
              </button>
              {actif && (
                <div className="hchr-jour-actions">
                  <button type="button" className={sourceCopie === j.iso ? "allume" : ""} disabled={nb === 0} title={t("Copier cette journée")} aria-label={t("Copier cette journée")} onClick={() => setSourceCopie(sourceCopie ? null : j.iso)}>
                    <IconPlus className="gozly-icon" />
                  </button>
                  <button type="button" disabled={nb === 0} title={t("Vider cette journée")} aria-label={t("Vider cette journée")} onClick={() => onViderJour(j.iso)}>
                    <IconCorbeille className="gozly-icon" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hchr-cadre">
        <div className="hchr-table">
          {reperes.map((m, i) => (
            <div key={i} className="hchr-repere" style={{ left: `calc((100% - var(--hchr-info)) * ${m / JOUR})`, height: geste.bas }}>
              <span>{heureTexte(m)}</span>
            </div>
          ))}
          <div className="hchr-ligne hchr-entete">
            <div className="hchr-heures">
              {HEURES.map((h) => (
                <div key={h} className="hchr-heure">{String(h).padStart(2, "0")}</div>
              ))}
            </div>
            <div className="hchr-info">
              <input type="text" value={recherche} onChange={(e) => onRecherche(e.target.value)} placeholder={t("Rechercher...")} />
            </div>
          </div>

          {employes.map((emp) => {
            const blocs = duJour
              .map((q) => ({ q, ...bloc(q), employeId: q.employe_id }))
              .map((b) => (geste?.bouge && geste.quart?.id === b.q.id ? { ...b, de: geste.de ?? b.de, a: geste.a ?? b.a, employeId: geste.employeId } : b))
              .filter((b) => String(b.employeId) === String(emp.id));
            const postes = [...new Set(blocs.map((b) => b.q.poste).filter(Boolean))];
            const semaine = quarts.filter((q) => q.employe_id === emp.id).reduce((s, q) => s + bloc(q).a - bloc(q).de, 0);
            const apercu = geste?.type === "peindre" && geste.bouge && String(geste.employeId) === String(emp.id) ? geste : null;
            return (
              <div className="hchr-ligne" key={emp.id}>
                <div
                  className="hchr-piste"
                  data-employe={emp.id}
                  onPointerDown={(e) => commencer(e, { type: "peindre", employeId: emp.id })}
                  onPointerMove={bouger}
                  onPointerUp={finir}
                  onPointerCancel={annuler}
                >
                  {HEURES.map((h) => (
                    <span key={h} className="hchr-case" />
                  ))}
                  {blocs.map(({ q, de, a }) => {
                    const base = { quart: q, de0: bloc(q).de, a0: bloc(q).a, de: bloc(q).de, a: bloc(q).a, employeId: q.employe_id };
                    const apresMinuit = bloc(q).a > JOUR;
                    return (
                      <div
                        key={q.id}
                        className={`hchr-bloc${q.publie ? "" : " brouillon"}`}
                        style={{ left: pourcent(de), width: pourcent(Math.min(a, JOUR) - de) }}
                        onPointerDown={(e) => commencer(e, { ...base, type: "deplacer" })}
                      >
                        <span className="hchr-poignee gauche" onPointerDown={(e) => commencer(e, { ...base, type: "debut" })} />
                        <strong>{emp.nom}</strong>
                        <span>{duree(a - de)} · {heureTexte(de)} - {heureTexte(a)}</span>
                        <button type="button" className="hchr-retirer" title={t("Retirer ce quart")} aria-label={t("Retirer ce quart")} onPointerDown={(e) => e.stopPropagation()} onClick={() => onSupprimer(q)}>
                          <IconCorbeille className="gozly-icon" />
                        </button>
                        {!apresMinuit && <span className="hchr-poignee droite" onPointerDown={(e) => commencer(e, { ...base, type: "fin" })} />}
                      </div>
                    );
                  })}
                  {apercu && (
                    <div className="hchr-bloc apercu" style={{ left: pourcent(apercu.de), width: pourcent(apercu.a - apercu.de) }}>
                      <strong>{duree(apercu.a - apercu.de)}</strong>
                      <span>{heureTexte(apercu.de)} - {heureTexte(apercu.a)}</span>
                    </div>
                  )}
                </div>
                <div className="hchr-info">
                  <strong title={emp.nom}>{emp.nom}</strong>
                  <span>{t("Semaine")} : {duree(semaine)}</span>
                  {postes.length > 0 && <span>{postes.join(", ")}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
