"use client";

import { useEffect, useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";

const ACCENTS = ["é", "è", "ê", "à", "â", "ç", "î", "ô", "û", "ù"];
const LIGNES = [["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"], ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"], ["w", "x", "c", "v", "b", "n"]];
const CHIFFRES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const SYMBOLES_1 = ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""];
const SYMBOLES_2 = [".", ",", "?", "!", "'", "#", "%", "+", "*"];

const enleverDernier = (s) => Array.from(s).slice(0, -1).join("");

// Les boutons ne volent jamais le focus : le champ touché reste le champ actif.
const sansFocus = (e) => e.preventDefault();

function Touche({ c, large = 2, onClick, classe = "", children, label }) {
  return (
    <button type="button" className={`sg-touche ${classe}`} style={{ gridColumn: `span ${large}` }} onPointerDown={sansFocus} onClick={onClick} aria-label={label}>
      {children ?? c}
    </button>
  );
}

// Cadre du haut : reprend ce qui est écrit dans le champ, pour ne pas avoir à regarder ailleurs en tapant.
function Miroir({ champ }) {
  return (
    <div className="sg-miroir">
      <span className="sg-miroir-label">{champ.label}</span>
      <div className="sg-miroir-texte">
        {champ.value ? champ.value : <span className="sg-miroir-vide">{champ.placeholder}</span>}
        <span className="sg-caret" />
      </div>
    </div>
  );
}

// Clavier (lettres / symboles) ou pavé numérique, selon le type du champ.
export function Clavier({ champ, onFermer }) {
  const { t } = useLangue();
  const [maj, setMaj] = useState(false);
  const [symboles, setSymboles] = useState(false);
  const { type, value, onChange, maxLength } = champ;

  useEffect(() => {
    setSymboles(false);
    setMaj(false);
  }, [champ.id]);

  const ajouter = (s) => {
    const suivant = value + s;
    if (maxLength && suivant.length > maxLength) return;
    onChange(suivant);
    if (maj) setMaj(false);
  };
  const effacer = () => onChange(enleverDernier(value));
  const lettre = (l) => (maj ? l.toUpperCase() : l);

  if (type === "tel" || type === "entier" || type === "decimal") {
    const extras = type === "tel" ? ["+", "-", " "] : type === "decimal" ? [","] : [];
    return (
      <div className="sg-clavier num">
        <Miroir champ={champ} />
        <div className="sg-grille">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <Touche key={n} c={n} large={2} classe="num" onClick={() => ajouter(n)} />
          ))}
          {extras.length > 0 ? <Touche c={extras[0] === " " ? "␣" : extras[0]} large={2} classe="num" onClick={() => ajouter(extras[0])} /> : <span style={{ gridColumn: "span 2" }} />}
          <Touche c="0" large={2} classe="num" onClick={() => ajouter("0")} />
          <Touche large={2} classe="num special" onClick={effacer} label={t("sg.effacer")}>⌫</Touche>
          {type === "tel" && (
            <>
              <Touche c="(" large={2} classe="num" onClick={() => ajouter("(")} />
              <Touche c=")" large={2} classe="num" onClick={() => ajouter(")")} />
              <Touche c="␣" large={2} classe="num" onClick={() => ajouter(" ")} />
            </>
          )}
        </div>
        <button type="button" className="sg-ok" onPointerDown={sansFocus} onClick={onFermer}>{t("sg.ok")}</button>
      </div>
    );
  }

  return (
    <div className="sg-clavier">
      <Miroir champ={champ} />
      <div className="sg-grille">
        {symboles ? (
          <>
            {CHIFFRES.map((c) => <Touche key={c} c={c} onClick={() => ajouter(c)} />)}
            {SYMBOLES_1.map((c) => <Touche key={c} c={c} onClick={() => ajouter(c)} />)}
            {SYMBOLES_2.map((c) => <Touche key={c} c={c} onClick={() => ajouter(c)} />)}
            <Touche large={2} classe="special" onClick={effacer} label={t("sg.effacer")}>⌫</Touche>
            <Touche large={4} classe="special" onClick={() => setSymboles(false)}>ABC</Touche>
          </>
        ) : (
          <>
            {ACCENTS.map((c) => <Touche key={c} c={lettre(c)} classe="accent" onClick={() => ajouter(lettre(c))} />)}
            {LIGNES[0].map((c) => <Touche key={c} c={lettre(c)} onClick={() => ajouter(lettre(c))} />)}
            {LIGNES[1].map((c) => <Touche key={c} c={lettre(c)} onClick={() => ajouter(lettre(c))} />)}
            <Touche large={3} classe={`special${maj ? " actif" : ""}`} onClick={() => setMaj((m) => !m)} label={t("sg.majuscule")}>⇧</Touche>
            {LIGNES[2].map((c) => <Touche key={c} c={lettre(c)} onClick={() => ajouter(lettre(c))} />)}
            <Touche large={3} classe="special" onClick={effacer} label={t("sg.effacer")}>⌫</Touche>
          </>
        )}
        {!symboles && (
          <>
            <Touche large={3} classe="special" onClick={() => setSymboles(true)}>123</Touche>
            <Touche c="'" large={2} onClick={() => ajouter("'")} />
            <Touche large={6} classe="espace" onClick={() => ajouter(" ")} label={t("sg.espace")}>{t("sg.espace")}</Touche>
            <Touche c="." large={2} onClick={() => ajouter(".")} />
            <Touche c="-" large={2} onClick={() => ajouter("-")} />
            {type === "textarea" && <Touche large={3} classe="special" onClick={() => ajouter("\n")}>↵</Touche>}
          </>
        )}
      </div>
      <button type="button" className="sg-ok" onPointerDown={sansFocus} onClick={onFermer}>{t("sg.ok")}</button>
    </div>
  );
}

const iso = (a, m, j) => `${a}-${String(m + 1).padStart(2, "0")}-${String(j).padStart(2, "0")}`;

// Petit calendrier : un mois à la fois, gros boutons, « Aujourd'hui » et « Demain » en raccourci.
export function Calendrier({ champ, onFermer, langue }) {
  const { t } = useLangue();
  const ajd = new Date();
  const [a0, m0] = champ.value ? champ.value.split("-").map(Number) : [ajd.getFullYear(), ajd.getMonth() + 1];
  const [vue, setVue] = useState({ a: a0, m: m0 - 1 });

  useEffect(() => {
    if (champ.value) {
      const [a, m] = champ.value.split("-").map(Number);
      setVue({ a, m: m - 1 });
    }
  }, [champ.id]);

  const loc = langue === "en" ? "en-CA" : "fr-CA";
  const premierJour = new Date(vue.a, vue.m, 1).getDay(); // 0 = dimanche
  const nbJours = new Date(vue.a, vue.m + 1, 0).getDate();
  const jours = [...Array(premierJour).fill(null), ...Array.from({ length: nbJours }, (_, i) => i + 1)];
  const nomsJours = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(loc, { weekday: "narrow" })); // 2023-01-01 = dimanche
  const aujourdhui = iso(ajd.getFullYear(), ajd.getMonth(), ajd.getDate());
  const demainDate = new Date(ajd.getFullYear(), ajd.getMonth(), ajd.getDate() + 1);
  const demain = iso(demainDate.getFullYear(), demainDate.getMonth(), demainDate.getDate());
  const bouge = (d) => setVue((v) => { const n = new Date(v.a, v.m + d, 1); return { a: n.getFullYear(), m: n.getMonth() }; });
  const choisir = (v) => {
    champ.onChange(v);
    onFermer();
  };

  return (
    <div className="sg-cal">
      <div className="sg-miroir">
        <span className="sg-miroir-label">{champ.label}</span>
        <div className="sg-miroir-texte">
          {champ.value ? new Date(...champ.value.split("-").map((n, i) => (i === 1 ? n - 1 : Number(n)))).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : " "}
        </div>
      </div>
      <div className="sg-cal-tete">
        <button type="button" className="sg-fleche" onClick={() => bouge(-1)} aria-label={t("sg.moisPrecedent")}>‹</button>
        <strong>{new Date(vue.a, vue.m, 1).toLocaleDateString(loc, { month: "long", year: "numeric" })}</strong>
        <button type="button" className="sg-fleche" onClick={() => bouge(1)} aria-label={t("sg.moisSuivant")}>›</button>
      </div>
      <div className="sg-cal-grille">
        {nomsJours.map((n, i) => <span className="sg-cal-jour-nom" key={i}>{n}</span>)}
        {jours.map((j, i) =>
          j === null ? (
            <span key={i} />
          ) : (
            <button key={i} type="button" className={`sg-cal-jour${iso(vue.a, vue.m, j) === champ.value ? " choisi" : ""}${iso(vue.a, vue.m, j) === aujourdhui ? " aujourdhui" : ""}`} onClick={() => choisir(iso(vue.a, vue.m, j))}>
              {j}
            </button>
          )
        )}
      </div>
      <div className="sg-raccourcis">
        <button type="button" className="sg-raccourci" onClick={() => choisir(aujourdhui)}>{t("sg.aujourdhui")}</button>
        <button type="button" className="sg-raccourci" onClick={() => choisir(demain)}>{t("sg.demain")}</button>
      </div>
    </div>
  );
}

const deuxChiffres = (n) => String(n).padStart(2, "0");

// Choix d'heure : les heures d'un côté, les minutes (par 5) de l'autre, tout visible d'un coup.
export function ChoixHeure({ champ, onFermer }) {
  const { t } = useLangue();
  const [h, m] = (champ.value || "12:00").split(":").map(Number);
  const maj = (nh, nm) => champ.onChange(`${deuxChiffres(nh)}:${deuxChiffres(nm)}`);

  return (
    <div className="sg-heure">
      <div className="sg-miroir">
        <span className="sg-miroir-label">{champ.label}</span>
        <div className="sg-miroir-texte grand">{champ.value || "--:--"}</div>
      </div>
      <span className="sg-sous-titre">{t("sg.heures")}</span>
      <div className="sg-heure-grille h">
        {Array.from({ length: 24 }, (_, i) => (
          <button key={i} type="button" className={`sg-heure-case${i === h ? " choisi" : ""}`} onClick={() => maj(i, m || 0)}>
            {deuxChiffres(i)}
          </button>
        ))}
      </div>
      <span className="sg-sous-titre">{t("sg.minutes")}</span>
      <div className="sg-heure-grille m">
        {Array.from({ length: 12 }, (_, i) => i * 5).map((n) => (
          <button key={n} type="button" className={`sg-heure-case${n === m ? " choisi" : ""}`} onClick={() => maj(Number.isFinite(h) ? h : 12, n)}>
            {deuxChiffres(n)}
          </button>
        ))}
      </div>
      <button type="button" className="sg-ok" onClick={onFermer}>{t("sg.ok")}</button>
    </div>
  );
}
