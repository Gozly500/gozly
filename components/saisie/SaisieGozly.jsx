"use client";

import { createContext, useContext, useRef, useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";
import { Clavier, Calendrier, ChoixHeure } from "@/components/saisie/PanneauxSaisie";

const Ctx = createContext(null);

const TYPES_CLAVIER = ["texte", "textarea", "tel", "entier", "decimal"];

// « 2026-10-22 » -> « jeu. 22 oct. 2026 »
function dateLisible(iso, langue) {
  if (!iso) return "";
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(a, m - 1, j).toLocaleDateString(langue === "en" ? "en-CA" : "fr-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// Fournit à ses champs (ChampGozly) un panneau de saisie propre à Gozly : quand on touche un champ, la fenêtre
// glisse à gauche et le panneau (clavier, calendrier ou choix d'heure) apparaît à droite, au lieu du clavier du
// système qui prend la moitié de l'écran. Pour une tablette. `actif = false` : aucun changement, les champs
// redeviennent des champs normaux.
export function SaisieGozly({ actif = true, children }) {
  const registre = useRef({});
  const [ouvertId, setOuvertId] = useState(null);
  const dernier = useRef(null);
  if (ouvertId) dernier.current = ouvertId;

  if (!actif) return children;

  const ctx = { registre, ouvertId, ouvrir: setOuvertId, fermer: () => setOuvertId(null) };

  return (
    <Ctx.Provider value={ctx}>
      <div className={`sg-duo${ouvertId ? " ouvert" : ""}`} onClick={(e) => e.stopPropagation()}>
        {children}
        <Panneau ctx={ctx} champId={dernier.current} />
      </div>
    </Ctx.Provider>
  );
}

// Le panneau est rendu APRÈS les champs : chaque champ s'inscrit dans le registre pendant son rendu, donc ici on lit
// toujours la valeur à jour (sinon une touche tapée vite partirait d'une valeur périmée et perdrait des lettres).
function Panneau({ ctx, champId }) {
  const { langue } = useLangue();
  const champ = ctx.registre.current[champId];
  return (
    <div className="sg-panneau" aria-hidden={!ctx.ouvertId}>
      <div className="sg-interne">
        {champ &&
          (TYPES_CLAVIER.includes(champ.type) ? (
            <Clavier champ={champ} onFermer={ctx.fermer} />
          ) : champ.type === "date" ? (
            <Calendrier champ={champ} onFermer={ctx.fermer} langue={langue} />
          ) : (
            <ChoixHeure champ={champ} onFermer={ctx.fermer} />
          ))}
      </div>
    </div>
  );
}

// Champ de formulaire : un champ normal sans SaisieGozly autour, ouvre le panneau Gozly avec.
// type : "texte" | "textarea" | "tel" | "entier" | "decimal" | "date" | "heure".
// onOuvre : appelé quand le champ est touché ; onBlur : quand il perd le focus (champ normal seulement).
export function ChampGozly({ id, type = "texte", label, value, onChange, placeholder, style, disabled, maxLength, rows, onOuvre, onBlur }) {
  const sg = useContext(Ctx);
  const { langue } = useLangue();

  if (!sg) {
    const commun = { value, onChange: (e) => onChange(e.target.value), placeholder, "aria-label": label, maxLength, style, disabled, onFocus: onOuvre, onBlur, autoComplete: "off" };
    if (type === "textarea") return <textarea {...commun} rows={rows} />;
    const natif = { texte: "text", tel: "tel", entier: "number", decimal: "text", date: "date", heure: "time" }[type];
    const mode = { tel: "tel", decimal: "decimal" }[type];
    return <input type={natif} inputMode={mode} min={type === "entier" ? 1 : undefined} {...commun} />;
  }

  sg.registre.current[id] = { id, type, label: label || placeholder || "", value, onChange, maxLength, placeholder };
  const actif = sg.ouvertId === id;
  const ouvrir = (e) => {
    if (disabled) return;
    sg.ouvrir(id);
    onOuvre?.();
    // Écran étroit : la fenêtre rétrécit au-dessus du panneau, on garde le champ touché bien en vue.
    const el = e?.currentTarget;
    setTimeout(() => el?.scrollIntoView?.({ block: "center", behavior: "smooth" }), 420);
  };
  const affiche = type === "date" ? dateLisible(value, langue) : value;
  const proprietes = {
    readOnly: true,
    inputMode: "none",
    value: affiche,
    placeholder,
    "aria-label": label,
    disabled,
    onFocus: ouvrir,
    onClick: ouvrir,
    className: `sg-champ${actif ? " actif" : ""}`,
    style,
  };

  return type === "textarea" ? <textarea {...proprietes} rows={rows} /> : <input type="text" {...proprietes} />;
}
