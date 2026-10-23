"use client";

import { useEffect, useRef, useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";

// Appui long sur une lettre : ses variantes accentuées (comme sur un vrai clavier). La première sert d'indice sur la touche.
const VARIANTES = { a: ["à", "â", "ä", "æ"], e: ["é", "è", "ê", "ë"], i: ["î", "ï"], o: ["ô", "ö", "œ"], u: ["ù", "û", "ü"], c: ["ç"], y: ["ÿ"], n: ["ñ"] };
// QWERTY (clavier canadien) : 10 + 9 + 7 lettres.
const LIGNES = [["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"], ["a", "s", "d", "f", "g", "h", "j", "k", "l"], ["z", "x", "c", "v", "b", "n", "m"]];
const CHIFFRES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const SYMBOLES_1 = ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""];
const SYMBOLES_2 = [".", ",", "?", "!", "'", "#", "%", "+", "*"];

const enleverDernier = (s) => Array.from(s).slice(0, -1).join("");

// Les boutons ne volent jamais le focus : le champ touché reste le champ actif.
const sansFocus = (e) => e.preventDefault();

// debut : colonne de départ (sur 20), pour centrer une rangée.
function Touche({ c, large = 2, debut, onClick, classe = "", children, label }) {
  return (
    <button type="button" className={`sg-touche ${classe}`} style={{ gridColumn: debut ? `${debut} / span ${large}` : `span ${large}` }} onPointerDown={sansFocus} onClick={onClick} aria-label={label}>
      {children ?? c}
    </button>
  );
}

// Touche de lettre : un appui court écrit la lettre, un appui long (0,4 s) ouvre ses variantes accentuées.
function ToucheLettre({ lettre, variantes, onChar, onVariantes }) {
  const minuteur = useRef(null);
  const long = useRef(false);
  const annuler = () => clearTimeout(minuteur.current);
  return (
    <button
      type="button"
      className="sg-touche"
      style={{ gridColumn: "span 2" }}
      onPointerDown={(e) => {
        e.preventDefault();
        long.current = false;
        if (!variantes) return;
        const el = e.currentTarget;
        minuteur.current = setTimeout(() => {
          long.current = true;
          onVariantes(el);
        }, 400);
      }}
      onPointerUp={annuler}
      onPointerLeave={annuler}
      onPointerCancel={annuler}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (long.current) {
          long.current = false; // l'appui long a déjà ouvert les variantes : pas de lettre en plus
          return;
        }
        onChar();
      }}
    >
      {lettre}
      {variantes && <i className="sg-indice">{variantes[0]}</i>}
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

  const [pop, setPop] = useState(null); // variantes ouvertes : { liste, left, top }
  const racine = useRef(null);

  useEffect(() => {
    setSymboles(false);
    setMaj(false);
    setPop(null);
  }, [champ.id]);

  // Variantes ouvertes : toucher ailleurs que sur elles les ferme.
  useEffect(() => {
    if (!pop) return;
    const dehors = (e) => {
      if (!e.target.closest?.(".sg-variantes")) setPop(null);
    };
    document.addEventListener("pointerdown", dehors);
    return () => document.removeEventListener("pointerdown", dehors);
  }, [pop]);

  function ouvrirVariantes(el, liste) {
    const largeur = liste.length * 54 + (liste.length - 1) * 6 + 16;
    const total = racine.current?.clientWidth || 0;
    const centre = el.offsetLeft + el.offsetWidth / 2;
    setPop({ liste, left: Math.max(largeur / 2 + 2, Math.min(total - largeur / 2 - 2, centre)), top: el.offsetTop });
  }

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

  const rendreLettre = (c) => {
    const variantes = VARIANTES[c];
    return (
      <ToucheLettre
        key={c}
        lettre={lettre(c)}
        variantes={variantes && variantes.map(lettre)}
        onChar={() => ajouter(lettre(c))}
        onVariantes={(el) => ouvrirVariantes(el, variantes.map(lettre))}
      />
    );
  };
  const vide = (n = 1) => <span style={{ gridColumn: `span ${n}` }} />;

  return (
    <div className="sg-clavier" ref={racine}>
      <Miroir champ={champ} />
      <div className="sg-grille">
        {symboles ? (
          <>
            {CHIFFRES.map((c) => <Touche key={c} c={c} onClick={() => ajouter(c)} />)}
            {SYMBOLES_1.map((c) => <Touche key={c} c={c} onClick={() => ajouter(c)} />)}
            {SYMBOLES_2.map((c) => <Touche key={c} c={c} onClick={() => ajouter(c)} />)}
            <Touche large={2} classe="special" onClick={effacer} label={t("sg.effacer")}>⌫</Touche>
            {/* Dernière rangée centrée : ABC + espace */}
            <Touche large={4} debut={5} classe="special" onClick={() => setSymboles(false)}>ABC</Touche>
            <Touche large={8} classe="espace" onClick={() => ajouter(" ")} label={t("sg.espace")}>{t("sg.espace")}</Touche>
          </>
        ) : (
          <>
            {LIGNES[0].map(rendreLettre)}
            {/* Rangée du milieu : 9 lettres, centrées */}
            {vide()}
            {LIGNES[1].map(rendreLettre)}
            {vide()}
            {/* Rangée du bas : ⇧ et ⌫ aux extrémités, les 7 lettres entre les deux */}
            <Touche large={3} classe={`special${maj ? " actif" : ""}`} onClick={() => setMaj((m) => !m)} label={t("sg.majuscule")}>⇧</Touche>
            {LIGNES[2].map(rendreLettre)}
            <Touche large={3} classe="special" onClick={effacer} label={t("sg.effacer")}>⌫</Touche>
            {/* Dernière rangée centrée (18 colonnes sur 20) */}
            <Touche large={4} debut={2} classe="special" onClick={() => setSymboles(true)}>123</Touche>
            <Touche c="'" large={2} onClick={() => ajouter("'")} />
            <Touche large={6} classe="espace" onClick={() => ajouter(" ")} label={t("sg.espace")}>{t("sg.espace")}</Touche>
            <Touche c="." large={2} onClick={() => ajouter(".")} />
            <Touche c="," large={2} onClick={() => ajouter(",")} />
            {type === "textarea" ? <Touche large={2} classe="special" onClick={() => ajouter("\n")}>↵</Touche> : <Touche c="-" large={2} onClick={() => ajouter("-")} />}
          </>
        )}
      </div>
      {pop && (
        <div className="sg-variantes" style={{ left: pop.left, top: pop.top }}>
          {pop.liste.map((v) => (
            <button key={v} type="button" className="sg-variante" onPointerDown={sansFocus} onClick={() => { ajouter(v); setPop(null); }}>
              {v}
            </button>
          ))}
        </div>
      )}
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

const Chevron = ({ bas }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 30, height: 30, transform: bas ? "rotate(180deg)" : undefined }}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);

// Une colonne « flèche haut / chiffre / flèche bas ». Garder le doigt sur une flèche fait défiler.
function Rouleau({ titre, valeur, onPas, labelHaut, labelBas }) {
  const delai = useRef(null);
  const boucle = useRef(null);
  const arreter = () => {
    clearTimeout(delai.current);
    clearInterval(boucle.current);
  };
  useEffect(() => arreter, []);

  const fleche = (sens, label) => (
    <button
      type="button"
      className="sg-fleche-spin"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        arreter();
        onPas(sens);
        delai.current = setTimeout(() => {
          boucle.current = setInterval(() => onPas(sens), 120);
        }, 450);
      }}
      onPointerUp={arreter}
      onPointerLeave={arreter}
      onPointerCancel={arreter}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPas(sens);
        }
      }}
    >
      <Chevron bas={sens < 0} />
    </button>
  );

  return (
    <div className="sg-rouleau">
      <span className="sg-sous-titre">{titre}</span>
      {fleche(1, labelHaut)}
      <div className="sg-rouleau-valeur">{deuxChiffres(valeur)}</div>
      {fleche(-1, labelBas)}
    </div>
  );
}

// Choix d'heure : heures et minutes, chacune avec une flèche vers le haut, le chiffre, et une flèche vers le bas.
// Les minutes avancent par 5 ; les heures bouclent (23 -> 00).
export function ChoixHeure({ champ, onFermer }) {
  const { t } = useLangue();
  const [h0, m0] = (champ.value || "12:00").split(":").map(Number);
  const h = Number.isFinite(h0) ? h0 : 12;
  const m = Number.isFinite(m0) ? m0 : 0;
  // Les flèches qui défilent (gardées enfoncées) lisent toujours la valeur et le champ à jour.
  const courant = useRef({ h, m, champ });
  courant.current = { h, m, champ };
  const ecrire = (nh, nm) => courant.current.champ.onChange(`${deuxChiffres(nh)}:${deuxChiffres(nm)}`);

  const pasHeure = (s) => ecrire((courant.current.h + s + 24) % 24, courant.current.m);
  const pasMinute = (s) => {
    const { m: cm, h: ch } = courant.current;
    const nm = s > 0 ? (Math.floor(cm / 5) + 1) * 5 : (Math.ceil(cm / 5) - 1) * 5; // se cale sur un multiple de 5
    ecrire(ch, (nm + 60) % 60);
  };

  return (
    <div className="sg-heure">
      <div className="sg-miroir">
        <span className="sg-miroir-label">{champ.label}</span>
        <div className="sg-miroir-texte grand">{champ.value || "--:--"}</div>
      </div>
      <div className="sg-rouleaux">
        <Rouleau titre={t("sg.heures")} valeur={h} onPas={pasHeure} labelHaut={t("sg.heurePlus")} labelBas={t("sg.heureMoins")} />
        <span className="sg-deux-points">:</span>
        <Rouleau titre={t("sg.minutes")} valeur={m} onPas={pasMinute} labelHaut={t("sg.minutePlus")} labelBas={t("sg.minuteMoins")} />
      </div>
      <button type="button" className="sg-ok" onClick={onFermer}>{t("sg.ok")}</button>
    </div>
  );
}
